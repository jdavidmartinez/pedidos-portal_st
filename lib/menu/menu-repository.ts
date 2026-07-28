import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/neon";

export interface MenuProduct {
  id: string;
  slug: string;
  categorySlug: string;
  name: string;
  description: string;
  individualPrice: number;
  comboPrice: number | null;
  imageUrl: string;
}

export interface MenuCategory {
  slug: string;
  name: string;
  products: MenuProduct[];
}

export interface AdminMenuProduct extends MenuProduct {
  availableQuantity: number | null;
  active: boolean;
  sortOrder: number;
}

export interface AdminMenuCategory {
  slug: string;
  name: string;
  active: boolean;
  sortOrder: number;
  products: AdminMenuProduct[];
}

export interface AdminMenuProductInput {
  categorySlug: string;
  name: string;
  description: string;
  individualPrice: number;
  comboPrice: number | null;
  imageUrl: string;
  availableQuantity: number | null;
  active: boolean;
  sortOrder: number;
}

interface MenuRow {
  category_slug: string;
  category_name: string;
  category_sort_order: number | string;
  product_id: string;
  product_slug: string;
  product_name: string;
  product_description: string;
  individual_price: number | string;
  combo_price: number | string | null;
  image_url: string;
  product_sort_order: number | string;
}

interface ProductRow {
  id: string;
  slug: string;
  category_slug: string;
  name: string;
  description: string;
  individual_price: number | string;
  combo_price: number | string | null;
  image_url: string;
}

interface AdminMenuRow extends MenuRow {
  category_active: boolean;
  product_active: boolean;
  available_quantity: number | string | null;
}

function toProduct(row: ProductRow | MenuRow): MenuProduct {
  const isJoinedRow = "product_id" in row;
  const description = "product_id" in row
    ? row.product_description
    : row.description;

  return {
    id: isJoinedRow ? row.product_id : row.id,
    slug: isJoinedRow ? row.product_slug : row.slug,
    categorySlug: row.category_slug,
    name: isJoinedRow ? row.product_name : row.name,
    description: description ?? "",
    individualPrice: Number(row.individual_price),
    comboPrice:
      row.combo_price === null ? null : Number(row.combo_price),
    imageUrl: row.image_url,
  };
}

function toAdminProduct(row: AdminMenuRow): AdminMenuProduct {
  return {
    ...toProduct(row),
    availableQuantity:
      row.available_quantity === null ? null : Number(row.available_quantity),
    active: row.product_active,
    sortOrder: Number(row.product_sort_order),
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `producto-${randomUUID()}`;
}

class MenuRepository {
  async listActive(): Promise<MenuCategory[]> {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        c.slug AS category_slug,
        c.name AS category_name,
        c.sort_order AS category_sort_order,
        p.id AS product_id,
        p.slug AS product_slug,
        p.name AS product_name,
        p.description AS product_description,
        p.individual_price,
        p.combo_price,
        p.image_url,
        p.sort_order AS product_sort_order
      FROM menu_categories c
      INNER JOIN menu_products p ON p.category_slug = c.slug
      WHERE c.active = TRUE AND p.active = TRUE
        AND (p.available_quantity IS NULL OR p.available_quantity > 0)
      ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC
    `) as unknown as MenuRow[];

    const categories = new Map<string, MenuCategory>();

    for (const row of rows) {
      const category = categories.get(row.category_slug) ?? {
        slug: row.category_slug,
        name: row.category_name,
        products: [],
      };

      category.products.push(toProduct(row));
      categories.set(row.category_slug, category);
    }

    return Array.from(categories.values());
  }

  async listActiveProducts(): Promise<MenuProduct[]> {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        p.id,
        p.slug,
        p.category_slug,
        p.name,
        p.description,
        p.individual_price,
        p.combo_price,
        p.image_url
      FROM menu_products p
      INNER JOIN menu_categories c ON c.slug = p.category_slug
      WHERE p.active = TRUE AND c.active = TRUE
        AND (p.available_quantity IS NULL OR p.available_quantity > 0)
      ORDER BY p.sort_order ASC, p.name ASC
    `) as unknown as ProductRow[];

    return rows.map(toProduct);
  }

  async listAdmin(): Promise<AdminMenuCategory[]> {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        c.slug AS category_slug,
        c.name AS category_name,
        c.sort_order AS category_sort_order,
        c.active AS category_active,
        p.id AS product_id,
        p.slug AS product_slug,
        p.name AS product_name,
        p.description AS product_description,
        p.individual_price,
        p.combo_price,
        p.image_url,
        p.available_quantity,
        p.sort_order AS product_sort_order,
        p.active AS product_active
      FROM menu_categories c
      LEFT JOIN menu_products p ON p.category_slug = c.slug
      ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC
    `) as unknown as AdminMenuRow[];

    const categories = new Map<string, AdminMenuCategory>();

    for (const row of rows) {
      const category = categories.get(row.category_slug) ?? {
        slug: row.category_slug,
        name: row.category_name,
        active: row.category_active,
        sortOrder: Number(row.category_sort_order),
        products: [],
      };

      if (row.product_id) category.products.push(toAdminProduct(row));
      categories.set(row.category_slug, category);
    }

    return Array.from(categories.values());
  }

  async createProduct(input: AdminMenuProductInput): Promise<AdminMenuProduct> {
    const sql = getSql();
    const id = randomUUID();
    const slug = slugify(input.name);

    await sql`
      INSERT INTO menu_products (
        id, slug, category_slug, name, description, individual_price,
        combo_price, image_url, available_quantity, active, sort_order
      ) VALUES (
        ${id}, ${slug}, ${input.categorySlug}, ${input.name.trim()},
        ${input.description.trim()}, ${input.individualPrice},
        ${input.comboPrice}, ${input.imageUrl.trim()}, ${input.availableQuantity}, ${input.active},
        ${input.sortOrder}
      )
    `;

    return this.getAdminProduct(id);
  }

  async updateProduct(
    id: string,
    input: AdminMenuProductInput
  ): Promise<AdminMenuProduct> {
    const sql = getSql();
    const rows = (await sql`
      UPDATE menu_products
      SET
        category_slug = ${input.categorySlug},
        name = ${input.name.trim()},
        description = ${input.description.trim()},
        individual_price = ${input.individualPrice},
        combo_price = ${input.comboPrice},
        image_url = ${input.imageUrl.trim()},
        available_quantity = ${input.availableQuantity},
        active = ${input.active},
        sort_order = ${input.sortOrder},
        updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `) as unknown[];

    if (rows.length === 0) {
      throw new MenuProductNotFoundError("El producto no existe.");
    }

    return this.getAdminProduct(id);
  }

  private async getAdminProduct(id: string): Promise<AdminMenuProduct> {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        c.slug AS category_slug,
        c.name AS category_name,
        c.sort_order AS category_sort_order,
        c.active AS category_active,
        p.id AS product_id,
        p.slug AS product_slug,
        p.name AS product_name,
        p.description AS product_description,
        p.individual_price,
        p.combo_price,
        p.image_url,
        p.available_quantity,
        p.sort_order AS product_sort_order,
        p.active AS product_active
      FROM menu_products p
      INNER JOIN menu_categories c ON c.slug = p.category_slug
      WHERE p.id = ${id}
    `) as unknown as AdminMenuRow[];

    if (rows.length === 0) {
      throw new MenuProductNotFoundError("El producto no existe.");
    }

    return toAdminProduct(rows[0] as AdminMenuRow);
  }
}

export class MenuProductNotFoundError extends Error {}

export const menuRepository = new MenuRepository();
