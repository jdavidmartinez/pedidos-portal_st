import { afterEach, expect, it, vi } from "vitest";
import { requestMenuChat } from "@/lib/chat/chat-client";
import { boundedChatHistory } from "@/lib/chat/chat-policy";
import { chatSchema } from "@/lib/chat/chat-schema";

afterEach(() => vi.unstubAllGlobals());
it("keeps the most recent history within server limits", () => {
  const history = Array.from({ length: 20 }, (_, n) => ({ role: "user" as const, text: `${n}` }));
  const recent = boundedChatHistory(history, "hello");
  expect(recent).toHaveLength(12);
  expect(recent[0].text).toBe("8");
  const large = boundedChatHistory(Array(20).fill({ role: "bot", text: "x".repeat(5000) }), "y".repeat(8000));
  expect(chatSchema.safeParse({ mensajeUsuario: "y".repeat(8000), historial: large }).success).toBe(true);
});
it.each([429, 503, 504])("shows server error %i as a readable chat message", async status => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Puedes continuar sin el asistente." }, { status })));
  expect(await requestMenuChat("hello", [])).toBe("Puedes continuar sin el asistente.");
});
it("handles network and malformed responses without inserting undefined messages", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
  expect(await requestMenuChat("hello", [])).toContain("sin el asistente");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
  expect(await requestMenuChat("hello", [])).toContain("sin el asistente");
});
it("sends a bounded request and displays a successful reply", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ respuesta: "Hola" }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await requestMenuChat("x".repeat(9000), [])).toBe("Hola");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).mensajeUsuario).toHaveLength(8000);
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
