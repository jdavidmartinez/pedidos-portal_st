import type { MenuCategory } from "@/lib/menu/menu-repository";

const formatPrice = (price: number) => price.toLocaleString("es-CO");

export function buildGeminiMenuContext(categories: MenuCategory[]) {
  return categories
    .map((category) => {
      const products = category.products.map((product) => {
        const description = product.description.trim()
          ? ` Descripción: ${product.description.trim()}`
          : "";
        const combo = product.comboPrice === null
          ? ""
          : `; combo $${formatPrice(product.comboPrice)} COP`;

        return `- ${product.name}: individual $${formatPrice(product.individualPrice)} COP${combo}.${description}`;
      });

      return [`Sección: ${category.name}`, ...products].join("\n");
    })
    .join("\n\n");
}
