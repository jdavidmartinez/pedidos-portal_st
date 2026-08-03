import { describe, expect, it } from "vitest";
import { campaignSchema } from "@/lib/campaigns/campaign-schema";

describe("campaignSchema", () => {
  it("acepta una promoción de producto con descuento entero", () => {
    expect(campaignSchema.parse({
      name: "Martes de Portal",
      productIds: ["hamburguesa-portal", "perro-portal"],
      discountPercent: 5,
      startsOn: "2026-07-30",
      endsOn: "2026-07-31",
      active: true,
    }).discountPercent).toBe(5);
  });

  it("rechaza porcentajes fuera de rango y fechas inválidas", () => {
    expect(() => campaignSchema.parse({
      name: "Campaña inválida",
      productIds: ["hamburguesa-portal"],
      discountPercent: 101,
      startsOn: "2026-02-30",
      endsOn: "2026-07-29",
      active: true,
    })).toThrow();
  });

  it("rechaza un rango invertido", () => {
    expect(() => campaignSchema.parse({
      name: "Campaña invertida",
      productIds: ["hamburguesa-portal"],
      discountPercent: 10,
      startsOn: "2026-07-31",
      endsOn: "2026-07-30",
      active: true,
    })).toThrow();
  });

  it("requiere al menos un producto y elimina duplicados", () => {
    expect(() => campaignSchema.parse({
      name: "Sin productos",
      productIds: [],
      discountPercent: 10,
      startsOn: "2026-08-03",
      endsOn: "2026-08-04",
      active: true,
    })).toThrow();

    expect(campaignSchema.parse({
      name: "Con duplicados",
      productIds: ["perro-portal", "perro-portal"],
      discountPercent: 10,
      startsOn: "2026-08-03",
      endsOn: "2026-08-04",
      active: true,
    }).productIds).toEqual(["perro-portal"]);
  });
});
