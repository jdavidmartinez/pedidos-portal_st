import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { neon } from "@neondatabase/serverless";
import { authenticateKitchenUser } from "@/lib/auth/kitchen-auth";
import { getTodayInColombia } from "@/lib/orders/date-range";
import type { Order } from "@/types/order";

const authState = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
}));

import { GET as getMenu } from "@/app/api/menu/route";
import { GET as getOrders, POST as postOrder } from "@/app/api/orders/route";
import { PATCH as patchOrder } from "@/app/api/orders/[id]/route";
import { GET as exportOrders } from "@/app/api/orders/export/route";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL debe estar configurada para ejecutar estas pruebas.");
}

const sql = neon(databaseUrl);
const testCustomerPrefix = `API TEST ${Date.now()}`;
const testPhone = "3000000001";

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    customer: {
      name: `${testCustomerPrefix} cliente`,
      address: "Calle 10 # 14-25",
      phone: testPhone,
    },
    items: [{ name: "HAMBURGUESA PORTAL", quantity: 1 }],
    observations: "Prueba automatizada",
    dataConsent: true,
    dataConsentVersion: "v3",
    ...overrides,
  };
}

async function postJson(payload: unknown, key: string) {
  return postOrder(
    new Request("http://test.local/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    })
  );
}

async function setKitchenSession() {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "api-test-secret";
  authState.token = authenticateKitchenUser("cocina", "portalst") ?? undefined;
  expect(authState.token).toBeTruthy();
}

beforeAll(async () => {
  await sql.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE 'API TEST %')",
    []
  );
  await sql.query("DELETE FROM orders WHERE customer_name LIKE 'API TEST %'", []);
});

afterAll(async () => {
  await sql.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE 'API TEST %')",
    []
  );
  await sql.query("DELETE FROM orders WHERE customer_name LIKE 'API TEST %'", []);
});

describe("orders API against Neon", () => {
  it("creates an order and normalizes the Colombian phone", async () => {
    const response = await postJson(orderPayload(), `api-create-${Date.now()}`);
    const body = (await response.json()) as { order: Order; duplicate: boolean };

    expect(response.status).toBe(201);
    expect(body.duplicate).toBe(false);
    expect(body.order.customer.phone).toBe("573000000001");
    expect(body.order.status).toBe("received");
    expect(body.order.subtotal).toBeGreaterThan(0);
  });

  it("returns the existing order for a repeated idempotency key", async () => {
    const key = `api-duplicate-${Date.now()}`;
    const first = await postJson(orderPayload(), key);
    const firstBody = (await first.json()) as { order: Order };
    const second = await postJson(orderPayload(), key);
    const secondBody = (await second.json()) as { order: Order; duplicate: boolean };

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.order.id).toBe(firstBody.order.id);
  });

  it("rechaza consentimiento, productos desconocidos y claves ausentes", async () => {
    const withoutConsent = await postJson(
      orderPayload({ dataConsent: false }),
      `api-consent-${Date.now()}`
    );
    const unknownProduct = await postJson(
      orderPayload({ items: [{ name: "PRODUCTO INEXISTENTE", quantity: 1 }] }),
      `api-product-${Date.now()}`
    );
    const missingKey = await postOrder(
      new Request("http://test.local/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload()),
      })
    );

    expect(withoutConsent.status).toBe(400);
    expect(unknownProduct.status).toBe(400);
    expect(missingKey.status).toBe(400);
  });

  it("sirve el catálogo activo con imágenes comic", async () => {
    const response = await getMenu();
    const body = (await response.json()) as {
      categories: Array<{ products: Array<{ imageUrl: string }> }>;
    };
    const products = body.categories.flatMap((category) => category.products);

    expect(response.status).toBe(200);
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) => product.imageUrl.includes("-comic.png"))).toBe(
      true
    );
  });

  it("protege, pagina y actualiza órdenes desde cocina", async () => {
    const created = await postJson(orderPayload(), `api-kitchen-${Date.now()}`);
    const createdBody = (await created.json()) as { order: Order };
    const unauthorized = await getOrders(
      new Request(`http://test.local/api/orders?date=${getTodayInColombia()}`)
    );

    expect(unauthorized.status).toBe(401);

    await setKitchenSession();
    const editPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            ...createdBody.order.customer,
            address: "Calle 20 # 30-40",
          },
          items: [{ name: "HAMBURGUESA PORTAL", quantity: 2 }],
          observations: "Pedido corregido",
          editReason: "Corrección solicitada por el cliente",
        }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    const editBody = (await editPatch.json()) as { order: Order };
    expect(editPatch.status).toBe(200);
    expect(editBody.order.customer.address).toBe("Calle 20 # 30-40");
    expect(editBody.order.items[0]?.quantity).toBe(2);

    const blockedPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    expect(blockedPatch.status).toBe(400);

    const zeroDeliveryPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryFee: 0 }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    const zeroStatusPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );

    const deliveryPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryFee: 7000 }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    const listResponse = await getOrders(
      new Request(
        `http://test.local/api/orders?date=${getTodayInColombia()}&page=1&pageSize=1`
      )
    );
    const listBody = (await listResponse.json()) as {
      orders: Order[];
      pagination: { pageSize: number; total: number };
    };
    const patchResponse = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "preparing" }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    const patchBody = (await patchResponse.json()) as { order: Order };

    expect(deliveryPatch.status).toBe(200);
    expect(zeroDeliveryPatch.status).toBe(200);
    expect(zeroStatusPatch.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(listBody.pagination.pageSize).toBe(1);
    expect(listBody.pagination.total).toBeGreaterThan(0);
    expect(patchResponse.status).toBe(200);
    expect(patchBody.order.status).toBe("preparing");

    const lateEditPatch = await patchOrder(
      new Request("http://test.local/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observations: "Edición tardía",
          editReason: "Intento después de aceptar",
        }),
      }),
      { params: Promise.resolve({ id: createdBody.order.id }) }
    );
    expect(lateEditPatch.status).toBe(409);
  });

  it("exporta el consolidado CSV del rango solicitado", async () => {
    const response = await exportOrders(
      new Request(
        `http://test.local/api/orders/export?from=${getTodayInColombia()}&until=${getTodayInColombia()}`
      )
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain("Orden");
    expect(csv).toContain(testCustomerPrefix);
  });
});
