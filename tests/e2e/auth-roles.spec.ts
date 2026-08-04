import { expect, test } from "@playwright/test";
import {
  E2E_ADMIN_USERNAME,
  E2E_KITCHEN_USERNAME,
  E2E_PASSWORD,
} from "./test-identity";

async function login(page: import("@playwright/test").Page, username: string, next = "") {
  await page.goto(`/cocina/login${next}`);
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test("protege cocina y administración cuando no hay sesión", async ({ page }) => {
  await page.goto("/cocina");
  await expect(page).toHaveURL(/\/cocina\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cocina\/login\?next=\/admin$/);
});

test("permite operar cocina pero bloquea administración al rol kitchen", async ({ page }) => {
  await login(page, E2E_KITCHEN_USERNAME);
  await expect(page).toHaveURL(/\/cocina$/);
  await expect(page.getByRole("heading", { name: "Terminal de cocina" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cocina$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/cocina\/login$/);
});

test("permite al administrador abrir el panel y simula una carga de imagen", async ({ page }) => {
  await page.route("**/api/admin/images", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        url: "https://example.test/menu-products/e2e-upload.webp",
        pathname: "menu-products/e2e-upload.webp",
      }),
    });
  });

  await login(page, E2E_ADMIN_USERNAME, "?next=/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Administrar menú" })).toBeVisible();

  await page.getByRole("button", { name: "+ Agregar producto" }).click();
  const newProduct = page.getByRole("heading", { name: "Nuevo producto" }).locator("..").locator("..");
  await newProduct.getByText("Subir imagen a Vercel").locator("input[type=file]").setInputFiles(
    "public/images/Logo-Portal.png"
  );
  await expect(newProduct.getByPlaceholder("Sube una imagen o pega una URL")).toHaveValue(
    "https://example.test/menu-products/e2e-upload.webp"
  );
  await expect(page.getByRole("status")).toContainText("Imagen subida");

  await page.goto("/admin/usuarios");
  await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Crear usuario" })).toBeVisible();
  await expect(page.getByText("Por seguridad no puedes modificar tu propio rol")).toBeVisible();
});
