import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/orders/export/route";
import * as auth from "@/lib/auth/kitchen-auth";
import { orderRepository } from "@/lib/orders/order-repository";
import type { Order } from "@/types/order";

afterEach(() => vi.restoreAllMocks());

it("protects exported text while preserving amounts, CSV structure and stored data", async () => {
  vi.spyOn(auth, "getKitchenSession").mockResolvedValue({
    userId: "test", username: "test", role: "kitchen", expiresAt: Date.now() + 60000,
  });
  const order: Order = {
    id: "test-order", number: 1,
    customer: { name: "=1+1", phone: "573000000001", address: "+1+1" },
    observations: '@SUM(1,1)\nSin "cebolla"',
    items: [{ name: "Hamburguesa", quantity: 1, variant: "individual", unitPrice: 15000, lineTotal: 15000 }],
    campaign: { id: "test", name: "-1+1", discountPercent: 0 },
    subtotal: 15000, discountPercent: 0, discountAmount: 0, deliveryFee: 2000, total: 17000,
    status: "received", receivedAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z", completedAt: null,
  };
  const original = structuredClone(order);
  vi.spyOn(orderRepository, "list").mockResolvedValue({ orders: [order], total: 1 });

  const response = await GET(new Request("http://test.local/api/orders/export?from=2026-09-10&until=2026-09-10"));

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Content-Disposition")).toContain("ordenes-2026-09-10-a-2026-09-10.csv");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes);
  expect(csv).toContain('"#0001","2026-09-10T12:00:00.000Z","\'=1+1","\'+573000000001","\'+1+1","\'@SUM(1,1)\nSin ""cebolla""","1x Hamburguesa (Individual)","15000","\'-1+1","0","0","15000","2000","17000","received",""\r\n');
  expect(order).toEqual(original);
});

it("requires a session before reading any orders", async () => {
  vi.spyOn(auth, "getKitchenSession").mockResolvedValue(null);
  const list = vi.spyOn(orderRepository, "list");
  const response = await GET(new Request("http://test.local/api/orders/export?date=2026-09-10"));
  expect(response.status).toBe(401);
  expect(list).not.toHaveBeenCalled();
});
