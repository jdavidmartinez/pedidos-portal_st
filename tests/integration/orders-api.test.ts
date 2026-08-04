import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { neon } from "@neondatabase/serverless";
import { createHmac, randomUUID } from "node:crypto";
import { authenticateKitchenUser } from "@/lib/auth/kitchen-auth";
import { authRepository } from "@/lib/auth/auth-repository";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
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
import { GET as getAdminMenu, POST as postAdminMenu } from "@/app/api/admin/menu/route";
import { PATCH as patchAdminMenu } from "@/app/api/admin/menu/[id]/route";
import {
  GET as getCampaigns,
  POST as postCampaign,
} from "@/app/api/admin/campaigns/route";
import {
  DELETE as deleteCampaign,
  PATCH as patchCampaign,
} from "@/app/api/admin/campaigns/[id]/route";
import { GET as getAdminUsers } from "@/app/api/admin/users/route";
import { PATCH as resetUserPassword } from "@/app/api/admin/users/[id]/password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { PATCH as changePassword } from "@/app/api/auth/password/route";

const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL debe estar configurada para ejecutar estas pruebas.");
}

const sql = neon(databaseUrl);
const testCustomerPrefix = `API TEST ${Date.now()}`;
const testPhone = "3000000001";
const testUsername = `api-kitchen-${Date.now()}`;
const testPassword = "API-test-password-123!";
const testAdminUsername = `api-admin-${Date.now()}`;
const testAdminPassword = "API-admin-password-123!";
const testProductPrefix = `API PRODUCT ${Date.now()}`;
const testCampaignPrefix = `API CAMPAIGN ${Date.now()}`;
let testKitchenUserId = "";

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
  const result = await authenticateKitchenUser(testUsername, testPassword, "api-test");
  authState.token = result.token;
  expect(authState.token).toBeTruthy();
}

async function setAdminSession() {
  const result = await authenticateKitchenUser(
    testAdminUsername,
    testAdminPassword,
    "api-test-admin"
  );
  authState.token = result.token;
  expect(result.user.role).toBe("admin");
}

function jsonRequest(path: string, method: string, payload: unknown) {
  return new Request(`http://test.local${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

beforeAll(async () => {
  const kitchenId = randomUUID();
  const adminId = randomUUID();
  await sql`
    INSERT INTO auth_users (id, username, password_hash, role)
    VALUES
      (${kitchenId}, ${testUsername}, ${await hashPassword(testPassword)}, 'kitchen'),
      (${adminId}, ${testAdminUsername}, ${await hashPassword(testAdminPassword)}, 'admin')
  `;
  testKitchenUserId = kitchenId;
  await sql.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE 'API TEST %')",
    []
  );
  await sql.query("DELETE FROM orders WHERE customer_name LIKE 'API TEST %'", []);
});

afterAll(async () => {
  authState.token = undefined;
  await sql`
    DELETE FROM campaigns WHERE name LIKE ${`${testCampaignPrefix}%`}
  `;
  await sql`
    DELETE FROM menu_products WHERE name LIKE ${`${testProductPrefix}%`}
  `;
  await sql`
    DELETE FROM auth_users WHERE username IN (${testUsername}, ${testAdminUsername})
  `;
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

  it("sirve el catálogo activo con imágenes WebP de Blob", async () => {
    const response = await getMenu();
    const body = (await response.json()) as {
      categories: Array<{ products: Array<{ imageUrl: string }> }>;
    };
    const products = body.categories.flatMap((category) => category.products);

    expect(response.status).toBe(200);
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((product) =>
      product.imageUrl.startsWith("https://zdflakunbsel3qht.public.blob.vercel-storage.com/menu-products/")
      && product.imageUrl.endsWith("-comic.webp")
    )).toBe(true);
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

  it("aplica roles y permite al administrador crear y editar productos", async () => {
    await setKitchenSession();
    expect((await getAdminMenu()).status).toBe(403);
    expect((await getCampaigns()).status).toBe(403);
    expect((await getAdminUsers()).status).toBe(403);

    await setAdminSession();
    const usersResponse = await getAdminUsers();
    const usersBody = (await usersResponse.json()) as {
      users: Array<{ username: string; role: string }>;
    };
    expect(usersResponse.status).toBe(200);
    expect(usersBody.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: testUsername, role: "kitchen" }),
        expect.objectContaining({ username: testAdminUsername, role: "admin" }),
      ])
    );

    const categories = await sql`SELECT slug FROM menu_categories WHERE active = TRUE ORDER BY sort_order LIMIT 1`;
    const categorySlug = String(categories[0]?.slug);
    const createResponse = await postAdminMenu(
      jsonRequest("/api/admin/menu", "POST", {
        categorySlug,
        name: `${testProductPrefix} UNO`,
        description: "Producto temporal de integración",
        individualPrice: 12345,
        comboPrice: null,
        imageUrl: "https://example.test/api-product.webp",
        availableQuantity: 5,
        active: true,
        sortOrder: 9999,
      })
    );
    const createBody = (await createResponse.json()) as {
      product: { id: string; name: string; individualPrice: number };
    };
    expect(createResponse.status).toBe(201);
    expect(createBody.product.individualPrice).toBe(12345);

    const updateResponse = await patchAdminMenu(
      jsonRequest(`/api/admin/menu/${createBody.product.id}`, "PATCH", {
        categorySlug,
        name: `${testProductPrefix} UNO EDITADO`,
        description: "Producto temporal actualizado",
        individualPrice: 15000,
        comboPrice: 20000,
        imageUrl: "https://example.test/api-product-updated.webp",
        availableQuantity: null,
        active: false,
        sortOrder: 9998,
      }),
      { params: Promise.resolve({ id: createBody.product.id }) }
    );
    const updateBody = (await updateResponse.json()) as {
      product: { name: string; active: boolean; comboPrice: number };
    };
    expect(updateResponse.status).toBe(200);
    expect(updateBody.product).toMatchObject({
      name: `${testProductPrefix} UNO EDITADO`,
      active: false,
      comboPrice: 20000,
    });
  });

  it("administra campañas con varios productos y rechaza fechas superpuestas", async () => {
    await setAdminSession();
    const products = await sql`
      SELECT id FROM menu_products WHERE active = TRUE ORDER BY sort_order, name LIMIT 2
    `;
    expect(products).toHaveLength(2);
    const productIds = products.map((product) => String(product.id));
    const payload = {
      name: `${testCampaignPrefix} PRINCIPAL`,
      imageUrl: "https://example.test/api-campaign.webp",
      productIds,
      discountPercent: 15,
      startsOn: "2098-03-01",
      endsOn: "2098-03-07",
      active: true,
    };
    const createResponse = await postCampaign(
      jsonRequest("/api/admin/campaigns", "POST", payload)
    );
    const createBody = (await createResponse.json()) as {
      campaign: { id: string; products: Array<{ id: string }> };
    };
    expect(createResponse.status).toBe(201);
    expect(createBody.campaign.products.map((product) => product.id).sort()).toEqual(
      [...productIds].sort()
    );

    const conflictResponse = await postCampaign(
      jsonRequest("/api/admin/campaigns", "POST", {
        ...payload,
        name: `${testCampaignPrefix} CONFLICTO`,
      })
    );
    expect(conflictResponse.status).toBe(409);

    const updateResponse = await patchCampaign(
      jsonRequest(`/api/admin/campaigns/${createBody.campaign.id}`, "PATCH", {
        ...payload,
        name: `${testCampaignPrefix} ACTUALIZADA`,
        productIds: [productIds[0]],
        active: false,
      }),
      { params: Promise.resolve({ id: createBody.campaign.id }) }
    );
    const updateBody = (await updateResponse.json()) as {
      campaign: { name: string; active: boolean; products: unknown[] };
    };
    expect(updateResponse.status).toBe(200);
    expect(updateBody.campaign).toMatchObject({
      name: `${testCampaignPrefix} ACTUALIZADA`,
      active: false,
    });
    expect(updateBody.campaign.products).toHaveLength(1);

    const deleteResponse = await deleteCampaign(
      new Request(`http://test.local/api/admin/campaigns/${createBody.campaign.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: createBody.campaign.id }) }
    );
    expect(deleteResponse.status).toBe(204);
  });

  it("limita intentos, revoca sesiones y protege cambios de contraseña", async () => {
    const clientAddress = `api-rate-${Date.now()}`;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(
        new Request("http://test.local/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-real-ip": clientAddress,
          },
          body: JSON.stringify({ username: testUsername, password: "incorrecta" }),
        })
      );
      expect(response.status).toBe(401);
    }
    const limitedResponse = await login(
      new Request("http://test.local/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": clientAddress },
        body: JSON.stringify({ username: testUsername, password: testPassword }),
      })
    );
    expect(limitedResponse.status).toBe(429);
    expect(Number(limitedResponse.headers.get("retry-after"))).toBeGreaterThan(0);

    const attemptKey = createHmac("sha256", process.env.AUTH_SECRET as string)
      .update(`${testUsername.toLocaleLowerCase("es-CO")}\0${clientAddress}`)
      .digest("hex");
    await sql`DELETE FROM auth_login_limits WHERE attempt_key = ${attemptKey}`;

    await setKitchenSession();
    const tokenBeforeLogout = authState.token as string;
    expect((await logout()).status).toBe(200);
    expect(await authRepository.getSession(tokenBeforeLogout)).toBeNull();

    await setKitchenSession();
    const oldToken = authState.token as string;
    const newPassword = "API-new-password-456!";
    const wrongCurrentResponse = await changePassword(
      jsonRequest("/api/auth/password", "PATCH", {
        currentPassword: "API-wrong-password-000!",
        newPassword,
        confirmation: newPassword,
      })
    );
    const mismatchResponse = await changePassword(
      jsonRequest("/api/auth/password", "PATCH", {
        currentPassword: testPassword,
        newPassword,
        confirmation: "API-different-password-456!",
      })
    );
    expect(wrongCurrentResponse.status).toBe(400);
    expect(mismatchResponse.status).toBe(400);

    const changeResponse = await changePassword(
      jsonRequest("/api/auth/password", "PATCH", {
        currentPassword: testPassword,
        newPassword,
        confirmation: newPassword,
      })
    );
    expect(changeResponse.status).toBe(200);
    expect(await authRepository.getSession(oldToken)).toBeNull();
    const sessionBeforeReset = await authenticateKitchenUser(
      testUsername,
      newPassword,
      "api-new-password"
    );
    expect(sessionBeforeReset.user.role).toBe("kitchen");

    authState.token = sessionBeforeReset.token;
    const forbiddenReset = await resetUserPassword(
      jsonRequest(`/api/admin/users/${testKitchenUserId}/password`, "PATCH", {
        newPassword: "API-forbidden-password-789!",
        confirmation: "API-forbidden-password-789!",
      }),
      { params: Promise.resolve({ id: testKitchenUserId }) }
    );
    expect(forbiddenReset.status).toBe(403);

    await setAdminSession();
    const resetPasswordValue = "API-reset-password-789!";
    const resetResponse = await resetUserPassword(
      jsonRequest(`/api/admin/users/${testKitchenUserId}/password`, "PATCH", {
        newPassword: resetPasswordValue,
        confirmation: resetPasswordValue,
      }),
      { params: Promise.resolve({ id: testKitchenUserId }) }
    );
    expect(resetResponse.status).toBe(200);
    expect(await authRepository.getSession(sessionBeforeReset.token)).toBeNull();
    const passwordRows = await sql`
      SELECT password_hash FROM auth_users WHERE id = ${testKitchenUserId}
    `;
    expect(await verifyPassword(resetPasswordValue, String(passwordRows[0]?.password_hash)))
      .toBe(true);
  });
});
