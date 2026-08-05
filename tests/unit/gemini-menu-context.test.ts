import { describe, expect, it } from "vitest";
import { buildGeminiMenuContext } from "@/lib/menu/gemini-menu-context";
import type { MenuCategory } from "@/lib/menu/menu-repository";

const catalog: MenuCategory[] = [
  {
    slug: "hamburguesas",
    name: "Hamburguesas",
    products: [
      {
        id: "hamburguesa-italiana",
        slug: "hamburguesa-italiana",
        categorySlug: "hamburguesas",
        name: "HAMBURGUESA ITALIANA",
        description: "Carne artesanal, queso y pepperoni.",
        individualPrice: 23500,
        comboPrice: 33300,
        imageUrl: "/images/Logo-Portal.png",
      },
    ],
  },
  {
    slug: "papas-especiales",
    name: "Papas y Especiales",
    products: [
      {
        id: "trocipollo",
        slug: "trocipollo",
        categorySlug: "papas-especiales",
        name: "TROCIPOLLO",
        description: "8 trozos de pollo apanados con papas.",
        individualPrice: 13000,
        comboPrice: null,
        imageUrl: "/images/Logo-Portal.png",
      },
    ],
  },
];

describe("buildGeminiMenuContext", () => {
  it("envía a Gemini secciones, descripciones y precios individuales y combo", () => {
    const context = buildGeminiMenuContext(catalog);

    expect(context).toContain("Sección: Hamburguesas");
    expect(context).toContain("HAMBURGUESA ITALIANA: individual $23.500 COP; combo $33.300 COP");
    expect(context).toContain("Descripción: Carne artesanal, queso y pepperoni.");
    expect(context).toContain("Sección: Papas y Especiales");
    expect(context).toContain("TROCIPOLLO: individual $13.000 COP.");
    expect(context).not.toContain("TROCIPOLLO: individual $13.000 COP; combo");
  });
});
