import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  recordOperationalEvent,
  reportOperationalError,
} from "../../lib/observability/server";

describe("observabilidad operacional", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OBSERVABILITY_WEBHOOK_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registra errores estructurados sin mensajes ni datos del cliente", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await reportOperationalError({
      event: "orders.create_failed",
      operation: "orders.create",
      dependency: "neon",
      status: 503,
      error: new Error("Cliente 3001234567 en postgres://usuario:clave@servidor/base"),
      route: "/api/orders",
      requestId: "iad1::abc",
    });

    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: "error",
      event: "orders.create_failed",
      dependency: "neon",
      status: 503,
      errorName: "Error",
      route: "/api/orders",
    });
    expect(JSON.stringify(payload)).not.toContain("3001234567");
    expect(JSON.stringify(payload)).not.toContain("postgres://");
  });

  it("registra resultados operacionales sin identificadores personales", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    recordOperationalEvent({
      event: "orders.create_succeeded",
      operation: "orders.create",
      dependency: "neon",
      durationMs: 45,
      result: "created",
    });
    expect(JSON.parse(String(infoSpy.mock.calls[0][0]))).toMatchObject({
      level: "info",
      durationMs: 45,
      result: "created",
    });
  });
});
