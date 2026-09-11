import { afterEach, expect, it, vi } from "vitest";

const { neon } = vi.hoisted(() => ({ neon: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon }));

const unsafeUrl = "postgresql://test:sentinel@ep-unsafe.neon.tech/neondb";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

it.each(["setup", "teardown"])("Playwright %s rejects unsafe targets before creating a database client", async (operation) => {
  vi.stubEnv("TEST_DATABASE_URL", unsafeUrl);
  vi.stubEnv("DEV_DATABASE_URL", unsafeUrl);
  const hook = operation === "setup"
    ? await import("../e2e/global-setup")
    : await import("../e2e/global-teardown");
  await expect(hook.default()).rejects.toThrow("coincide con DEV_DATABASE_URL");
  expect(neon).not.toHaveBeenCalled();
});

it.each(["playwright", "integration"])("%s configuration rejects unsafe targets before starting tests or a server", async (runner) => {
  vi.stubEnv("TEST_DATABASE_URL", unsafeUrl);
  vi.stubEnv("DEV_DATABASE_URL", unsafeUrl);
  const config = runner === "playwright"
    ? import("../../playwright.config")
    : import("../../vitest.integration.config");
  await expect(config).rejects.toThrow("coincide con DEV_DATABASE_URL");
  expect(neon).not.toHaveBeenCalled();
});

it("Playwright starts its own server with the validated target and never reuses an unknown server", async () => {
  vi.stubEnv("TEST_DATABASE_URL", unsafeUrl);
  for (const name of ["DATABASE_URL", "DEV_DATABASE_URL", "PRODUCTION_DATABASE_URL", "RECOVERY_DATABASE_URL", "VERCEL_ENV"]) {
    vi.stubEnv(name, "");
  }
  const { default: config } = await import("../../playwright.config");
  expect(config.webServer).toMatchObject({
    reuseExistingServer: false,
    env: { DATABASE_URL: unsafeUrl },
  });
  expect(neon).not.toHaveBeenCalled();
});
