import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { RequestError } from "@/lib/http/request-error";
const { limit, recover, finish } = vi.hoisted(() => ({ limit: vi.fn(), recover: vi.fn(), finish: vi.fn() }));
vi.mock("@/lib/http/public-rate-limit", () => ({ consumePublicRateLimit: limit }));
vi.mock("@/lib/auth/password-recovery", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/auth/password-recovery")>(),
  requestPasswordRecovery: recover, finishPasswordRecovery: finish,
}));
const request = (body: unknown) => new Request("https://test", { method: "POST", body: JSON.stringify(body) });
const token = "a".repeat(43);
const password = "NewPassword123!";
beforeEach(() => { vi.resetAllMocks(); limit.mockResolvedValue(undefined); recover.mockResolvedValue(undefined); finish.mockResolvedValue(true); vi.spyOn(console, "error").mockImplementation(() => undefined); });
afterEach(() => vi.restoreAllMocks());
it("does not expose whether an email exists or delivery failed", async () => {
  const first = await forgot(request({ email: "unknown@example.com" }));
  recover.mockRejectedValue(new Error("private provider details"));
  const second = await forgot(request({ email: "known@example.com" }));
  expect(first.status).toBe(200); expect(second.status).toBe(200);
  expect(await first.json()).toEqual(await second.json());
});
it.each([forgot, reset])("enforces quotas before recovery work", async post => {
  limit.mockRejectedValue(new RequestError("Espera.", 429, 60));
  const response = await post(request({ email: "test@example.com", token, password, confirmation: password }));
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  expect(recover).not.toHaveBeenCalled(); expect(finish).not.toHaveBeenCalled();
});
it.each([null, {}, { email: "invalid" }])("rejects malformed email input", async body => {
  expect((await forgot(request(body))).status).toBe(400); expect(recover).not.toHaveBeenCalled();
});
it.each([{ token: "bad", password, confirmation: password }, { token, password: "weak", confirmation: "weak" }, { token, password, confirmation: "different" }])("rejects invalid reset submissions", async body => {
  expect((await reset(request(body))).status).toBe(400); expect(finish).not.toHaveBeenCalled();
});
it("rejects expired or already used links", async () => {
  finish.mockResolvedValue(false);
  expect((await reset(request({ token, password, confirmation: password }))).status).toBe(400);
});
it("accepts a valid reset without signing in automatically", async () => {
  const response = await reset(request({ token, password, confirmation: password }));
  expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toBeNull();
  expect(finish).toHaveBeenCalledWith(token, password);
});
it.each([forgot, reset])("rejects oversized payloads", async post => {
  expect((await post(request({ value: "x".repeat(4096) }))).status).toBe(413);
});
