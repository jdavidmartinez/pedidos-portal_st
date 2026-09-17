import { describe, expect, it } from "vitest";
import { deliveryZoneConfigSchema } from "@/lib/orders/delivery-zone-schema";

const validZone = {
  code: "zone_1",
  name: "Zona 1 — Villa Claudia y sur cercano",
  fee: 4000,
  active: true,
  sortOrder: 1,
};

describe("deliveryZoneConfigSchema", () => {
  it("acepta una configuración de zona válida", () => {
    expect(deliveryZoneConfigSchema.safeParse(validZone).success).toBe(true);
  });

  it("rechaza códigos y tarifas no permitidos", () => {
    expect(deliveryZoneConfigSchema.safeParse({ ...validZone, code: "north" }).success).toBe(false);
    expect(deliveryZoneConfigSchema.safeParse({ ...validZone, fee: -1 }).success).toBe(false);
  });
});
