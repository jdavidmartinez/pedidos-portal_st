import { describe, expect, it } from "vitest";
import { getPasswordPolicyError } from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("acepta una contraseña que cumple todos los requisitos", () => {
    expect(getPasswordPolicyError("Portal-seguro-123!")).toBeNull();
  });

  it.each([
    ["corta1!A", "entre 12 y 128"],
    ["SOLO-MAYUSCULAS-123!", "minúscula"],
    ["solo-minusculas-123!", "mayúscula"],
    ["Sin-numeros-aqui!", "número"],
    ["SinSimbolos1234", "símbolo"],
  ])("rechaza %s", (password, expectedMessage) => {
    expect(getPasswordPolicyError(password)).toContain(expectedMessage);
  });
});
