import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/orders/route";
import { DatabaseNotConfiguredError } from "@/lib/db/neon";
import {
  InvalidCustomerPhoneError,
  InvalidOrderItemError,
  orderRepository,
} from "@/lib/orders/order-repository";
import { DATA_PROCESSING_POLICY_VERSION } from "@/lib/privacy/data-processing";

function request() {
  return new Request("http://test.local/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "error-regression-test",
      "x-vercel-id": "test-request-id",
    },
    body: JSON.stringify({
      customer: { name: "Test Customer", address: "Calle 10 # 20-30", phone: "3000000001" },
      items: [{ name: "Test product", quantity: 1 }],
      dataConsent: true,
      dataConsentVersion: DATA_PROCESSING_POLICY_VERSION,
    }),
  });
}

describe("public order creation errors", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    new Error("private-sentinel postgres://user:password@internal/orders SQL failed"),
    { message: "private-sentinel", connection: "postgres://user:password@internal/orders" },
  ])("hides unexpected failures while recording a sanitized operational event", async (failure) => {
    vi.spyOn(orderRepository, "create").mockRejectedValue(failure);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "No fue posible crear la orden. Inténtalo nuevamente." });
    expect(body).not.toContain("private-sentinel");
    const logs = vi.mocked(console.error).mock.calls;
    expect(logs).toHaveLength(1);
    expect(JSON.parse(String(logs[0][0]))).toMatchObject({
      event: "orders.create_failed",
      status: 500,
      dependency: "neon",
      requestId: "test-request-id",
    });
    expect(JSON.stringify(logs)).not.toContain("private-sentinel");
    expect(JSON.stringify(logs)).not.toContain("postgres://");
  });

  it("hides internal database configuration details and preserves the 503 status", async () => {
    vi.spyOn(orderRepository, "create").mockRejectedValue(new DatabaseNotConfiguredError());

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No fue posible crear la orden. Inténtalo nuevamente." });
    expect(JSON.parse(String(vi.mocked(console.error).mock.calls[0][0]))).toMatchObject({
      event: "neon.unavailable", status: 503,
    });
  });

  it.each([
    new InvalidOrderItemError("El producto no está disponible."),
    new InvalidCustomerPhoneError("El celular colombiano debe comenzar por 3."),
  ])("preserves actionable validation messages", async (failure) => {
    vi.spyOn(orderRepository, "create").mockRejectedValue(failure);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: failure.message });
    expect(console.error).not.toHaveBeenCalled();
  });
});
