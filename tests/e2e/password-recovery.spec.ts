import { expect, test } from "@playwright/test";

test("login links to the recovery form", async ({ page }) => {
  await page.goto("/cocina/login");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeVisible();
});
test("reset link selects password form and removes the secret from the URL", async ({ page }) => {
  await page.goto(`/recuperar-contrasena#token=${"a".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("NewPassword123!");
  await page.getByLabel("Confirmar contraseña").fill("NewPassword123!");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("El enlace no es válido o ha vencido");
  await page.getByRole("link", { name: "Solicitar otro enlace" }).click();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
});
