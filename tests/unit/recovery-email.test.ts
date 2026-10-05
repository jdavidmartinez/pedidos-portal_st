import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recoveryEmailConfig, sendRecoveryEmail } from "@/lib/auth/recovery-email";
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key"); vi.stubEnv("PASSWORD_RESET_FROM", "Portal <onboarding@resend.dev>");
  vi.stubEnv("APP_ORIGIN", "https://portal.example.com"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "test" })));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each(["http://evil.example", "https://user:pass@portal.example", "https://portal.example/path", "https://portal.example?query=1"])('rejects unsafe origins: %s', origin => {
  vi.stubEnv("APP_ORIGIN", origin); expect(() => recoveryEmailConfig()).toThrow();
});
it("sends only to the account address with a fragment token", async () => {
  await sendRecoveryEmail("test@example.com", "a".repeat(43));
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  const body = JSON.parse(String(options?.body));
  expect(body.to).toEqual(["test@example.com"]);
  expect(body.text).toContain("https://portal.example.com/recuperar-contrasena#token=");
});
it("does not expose provider error bodies", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("private details", { status: 403 }));
  await expect(sendRecoveryEmail("test@example.com", "a".repeat(43))).rejects.toThrow("PasswordRecoveryEmailFailed");
});
