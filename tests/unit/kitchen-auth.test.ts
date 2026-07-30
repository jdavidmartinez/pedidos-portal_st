import { afterEach, describe, expect, it } from "vitest";
import { authenticateKitchenUser } from "@/lib/auth/kitchen-auth";

describe("authenticateKitchenUser", () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("emite un token para las credenciales temporales válidas", () => {
    process.env.AUTH_SECRET = "unit-test-secret";

    const token = authenticateKitchenUser("cocina", "portalst");

    expect(token).toEqual(expect.any(String));
    expect(token?.split(".")).toHaveLength(2);
  });

  it("rechaza usuario o contraseña incorrectos", () => {
    process.env.AUTH_SECRET = "unit-test-secret";

    expect(authenticateKitchenUser("otro", "portalst")).toBeNull();
    expect(authenticateKitchenUser("cocina", "incorrecta")).toBeNull();
  });

  it("falla de forma explícita si falta AUTH_SECRET", () => {
    expect(() => authenticateKitchenUser("cocina", "portalst")).toThrow(
      "Falta AUTH_SECRET"
    );
  });
});
