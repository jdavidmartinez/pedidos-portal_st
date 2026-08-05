import { describe, expect, it } from "vitest";
import { createOrderSchema, updateOrderSchema } from "@/lib/orders/order-schema";

const validOrder = {
  customer: {
    name: "Cliente de prueba",
    address: "Calle 10 # 14-25",
    phone: "3213166885",
  },
  items: [{ name: "HAMBURGUESA PORTAL", quantity: 2 }],
  observations: "Sin cebolla",
  dataConsent: true as const,
  dataConsentVersion: "v3",
};

describe("createOrderSchema", () => {
  it("acepta una orden completa y normalizable", () => {
    const result = createOrderSchema.safeParse(validOrder);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items[0].variant).toBe("individual");
  });

  it("acepta explícitamente una presentación combo", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ name: "HAMBURGUESA PORTAL", quantity: 1, variant: "combo" }],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una orden sin consentimiento", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      dataConsent: false,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza observaciones de más de 500 caracteres", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      observations: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("rechaza cantidades no enteras o menores que uno", () => {
    const fractional = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ name: "Producto", quantity: 1.5 }],
    });
    const zero = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ name: "Producto", quantity: 0 }],
    });

    expect(fractional.success).toBe(false);
    expect(zero.success).toBe(false);
  });
});

describe("updateOrderSchema", () => {
  it("requiere al menos un cambio", () => {
    expect(updateOrderSchema.safeParse({}).success).toBe(false);
    expect(updateOrderSchema.safeParse({ status: "preparing" }).success).toBe(
      true
    );
    expect(updateOrderSchema.safeParse({ deliveryFee: 5000 }).success).toBe(
      true
    );
  });

  it("permite corregir el contenido de la orden sin motivo", () => {
    expect(
      updateOrderSchema.safeParse({
        items: [{ name: "HAMBURGUESA PORTAL", quantity: 2 }],
      }).success
    ).toBe(true);
    expect(
      updateOrderSchema.safeParse({
        items: [{ name: "HAMBURGUESA PORTAL", quantity: 2 }],
        editReason: "Corrección solicitada por el cliente",
      }).success
    ).toBe(true);
  });
});
