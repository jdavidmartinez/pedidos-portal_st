import { expect, test } from "@playwright/test";

const product = {
  id: "e2e-product-portal",
  slug: "producto-e2e",
  name: "PRODUCTO E2E PORTAL",
  description: "Producto ficticio para pruebas de navegador",
  individualPrice: 15000,
  comboPrice: null,
  imageUrl: "/images/Logo-Portal.png",
};

test("muestra una campaña y completa el flujo del pedido sin escribir en Neon", async ({
  page,
}) => {
  let submittedPayload: Record<string, unknown> | undefined;
  let idempotencyKey = "";

  await page.route("**/api/menu", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        categories: [
          { name: "Especiales E2E", products: [product] },
          { name: "Bebidas E2E", products: [{ ...product, id: "e2e-drink", name: "BEBIDA E2E" }] },
        ],
        campaign: {
          id: "campaign-e2e",
          name: "PROMOCIÓN E2E",
          imageUrl: "/images/Logo-Portal.png",
          products: [{ id: product.id, name: product.name, imageUrl: product.imageUrl }],
          discountPercent: 20,
          startsOn: "2026-08-01",
          endsOn: "2026-08-31",
        },
      }),
    });
  });

  await page.route("**/api/orders", async (route) => {
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    idempotencyKey = route.request().headers()["idempotency-key"] ?? "";
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        order: {
          id: "order-e2e",
          number: 9999,
          customer: {
            name: "Cliente E2E",
            address: "Calle E2E # 1-23",
            phone: "573001112233",
          },
          items: [{ name: product.name, quantity: 1, unitPrice: 15000, lineTotal: 15000 }],
          subtotal: 15000,
          discountPercent: 0,
          discountAmount: 0,
          campaign: null,
          deliveryFee: null,
          total: 15000,
          observations: "Prueba desde Playwright",
          status: "received",
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
        },
      }),
    });
  });

  await page.goto("/menu");

  const promotion = page.getByRole("dialog", { name: "PROMOCIÓN E2E" });
  await expect(promotion).toBeVisible();
  await expect(promotion).toContainText("20%");
  await expect(promotion).toContainText(product.name);
  await page.getByRole("button", { name: "Cerrar promoción" }).click();

  const sections = page.getByRole("navigation", { name: "Secciones del menú" });
  await expect(sections.getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: `Agregar una unidad de ${product.name}` }).click();
  await expect(page.getByText("1 producto en tu pedido")).toBeVisible();
  await page.getByRole("button", { name: "Continuar con el pedido" }).click();

  await page.getByPlaceholder("Tu nombre").fill("Cliente E2E");
  await page.getByPlaceholder("Ej. Calle 10 #14-25").fill("Calle E2E # 1-23");
  await page.getByPlaceholder("Ej. 3213166885").fill("3001112233");
  await page.getByPlaceholder("Ej. Sin cebolla, llamar al llegar...").fill(
    "Prueba desde Playwright"
  );
  await page.getByRole("button", { name: "Enviar pedido", exact: true }).click();

  await expect(page.getByText("Tu pedido ha sido recibido por el restaurante.").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "WhatsApp" })).toBeVisible();
  expect(idempotencyKey).not.toBe("");
  expect(submittedPayload).toMatchObject({
    customer: {
      name: "Cliente E2E",
      address: "Calle E2E # 1-23",
      phone: "3001112233",
    },
    items: [{ name: product.name, quantity: 1 }],
    observations: "Prueba desde Playwright",
    dataConsent: true,
    dataConsentVersion: "v3",
  });
});

test("permite navegar el menú con teclado y sin desbordamiento en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route("**/api/menu", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        categories: [{ name: "Especiales E2E", products: [product] }],
        campaign: {
          id: "campaign-accessibility",
          name: "PROMOCIÓN ACCESIBLE",
          imageUrl: product.imageUrl,
          products: [{ id: product.id, name: product.name, imageUrl: product.imageUrl }],
          discountPercent: 15,
          startsOn: "2026-08-01",
          endsOn: "2026-08-31",
        },
      }),
    });
  });

  await page.goto("/menu");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");

  const promotion = page.getByRole("dialog", { name: "PROMOCIÓN ACCESIBLE" });
  await expect(promotion).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar promoción" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(promotion).toBeHidden();

  const addButton = page.getByRole("button", { name: `Agregar una unidad de ${product.name}` });
  await addButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(`1 unidades de ${product.name}`)).toBeVisible();
  await page.getByRole("button", { name: "Continuar con el pedido" }).click();

  const orderDialog = page.getByRole("dialog", { name: "Confirmar pedido" });
  await expect(orderDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeFocused();
  await expect(page.getByLabel("Nombre Completo")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(orderDialog).toBeHidden();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBe(false);
});
