import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("genera hashes con sal diferentes y verifica la contraseña", async () => {
    const first = await hashPassword("Una-clave-segura-123");
    const second = await hashPassword("Una-clave-segura-123");

    expect(first).not.toBe(second);
    expect(await verifyPassword("Una-clave-segura-123", first)).toBe(true);
    expect(await verifyPassword("incorrecta", first)).toBe(false);
  });

  it("rechaza hashes desconocidos o dañados", async () => {
    expect(await verifyPassword("clave", "bcrypt$invalid")).toBe(false);
    expect(await verifyPassword("clave", "scrypt$invalid$invalid")).toBe(false);
  });
});
