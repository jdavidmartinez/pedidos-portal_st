import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as orderPost } from "@/app/api/orders/route";
import { POST as chatPost } from "@/app/api/chat-menu/route";
import { orderRepository } from "@/lib/orders/order-repository";
import { menuRepository } from "@/lib/menu/menu-repository";
import { RequestError } from "@/lib/http/request-error";
import { PUBLIC_BODY_MAX_BYTES } from "@/lib/http/bounded-json";
const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/lib/http/public-rate-limit", () => ({ consumePublicRateLimit: limit }));

beforeEach(() => {
  limit.mockReset().mockResolvedValue(undefined);
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "fake-test-key");
  vi.spyOn(menuRepository, "listActive").mockResolvedValue([]);
  vi.spyOn(orderRepository, "create");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = (body: unknown) => new Request("http://test", { method: "POST", headers: { "Idempotency-Key": "test", "Content-Type": "application/json" }, body: JSON.stringify(body) });

it.each([orderPost, chatPost])("rejects exhausted quotas before repository or Gemini work", async post => {
  limit.mockRejectedValue(new RequestError("Espera un momento.", 429, 30));
  const response = await post(request({}));
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("30");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(orderRepository.create).not.toHaveBeenCalled();
  expect(menuRepository.listActive).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it.each([orderPost, chatPost])("returns a safe 503 when rate limiting is unavailable", async post => {
  limit.mockRejectedValue(new RequestError("Servicio no disponible.", 503));
  expect((await post(request({}))).status).toBe(503);
  expect(orderRepository.create).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it.each([orderPost, chatPost])("rejects oversized bodies before application work", async post => {
  expect((await post(request({ value: "x".repeat(PUBLIC_BODY_MAX_BYTES) }))).status).toBe(413);
  expect(orderRepository.create).not.toHaveBeenCalled();
  expect(menuRepository.listActive).not.toHaveBeenCalled();
});
it.each([null, {}, { mensajeUsuario: " " }, { mensajeUsuario: "x".repeat(8001) },
  { mensajeUsuario: "hello", historial: Array(13).fill({ role: "user", text: "hi" }) },
  { mensajeUsuario: "hello", historial: [{ role: "system", text: "hi" }] },
  { mensajeUsuario: "hello", historial: [{ role: "bot", text: "x".repeat(4001) }] },
  { mensajeUsuario: "x".repeat(8000), historial: Array(3).fill({ role: "bot", text: "x".repeat(4000) }) },
])("rejects invalid chat input before calling Gemini", async input => {
  expect((await chatPost(request(input))).status).toBe(400);
  expect(menuRepository.listActive).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("returns 400 for malformed chat JSON", async () => {
  expect((await chatPost(new Request("http://test", { method: "POST", body: "{" }))).status).toBe(400);
});
it("handles disabled Gemini without making an upstream request", async () => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
  expect((await chatPost(request({ mensajeUsuario: "hello" }))).status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
it("serves valid chat and sets an upstream output cap", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "Hola" }] } }] }));
  const response = await chatPost(request({ mensajeUsuario: "hello", historial: [] }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ respuesta: "Hola" });
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).generationConfig.maxOutputTokens).toBe(1024);
});
it("returns a safe upstream error", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("private-sentinel", { status: 500 }));
  const response = await chatPost(request({ mensajeUsuario: "hello" }));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private-sentinel");
});
it.each([false, true])("aborts Gemini at 15 seconds including stalled response bodies (%s)", async stallBody => {
  vi.useFakeTimers();
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    entered();
    if (stallBody) return new Response(new ReadableStream({ start(controller) {
      init!.signal!.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    } }));
    return new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  });
  const result = chatPost(request({ mensajeUsuario: "hello" }));
  await started;
  await vi.advanceTimersByTimeAsync(15000);
  const response = await result;
  expect(response.status).toBe(504);
  expect((await response.json()).error).toContain("sin el asistente");
  expect(vi.getTimerCount()).toBe(0);
});
