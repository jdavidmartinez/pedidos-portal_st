import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/neon";
import type { CampaignInput } from "@/lib/campaigns/campaign-schema";

export interface Campaign {
  id: string;
  name: string;
  imageUrl: string;
  products: Array<{ id: string; name: string; imageUrl: string }>;
  discountPercent: number;
  startsOn: string;
  endsOn: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export class CampaignNotFoundError extends Error {}
export class CampaignDateConflictError extends Error {}

interface CampaignRow {
  id: string;
  name: string;
  image_url: string | null;
  products: unknown;
  discount_percent: number | string;
  starts_on: string | Date;
  ends_on: string | Date;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function toISODate(value: string | Date) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function toCampaign(row: CampaignRow): Campaign {
  const products = Array.isArray(row.products) ? row.products : [];
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url ?? "",
    products: products.map((product) => {
      const value = product as Record<string, unknown>;
      return {
        id: String(value.id),
        name: String(value.name),
        imageUrl: String(value.imageUrl),
      };
    }),
    discountPercent: Number(row.discount_percent),
    startsOn: toISODate(row.starts_on),
    endsOn: toISODate(row.ends_on),
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

class CampaignRepository {
  async list(): Promise<Campaign[]> {
    const sql = getSql();
    const rows = (await sql`
      SELECT c.id, c.name, c.image_url, c.discount_percent, c.starts_on, c.ends_on,
             c.active, c.created_at, c.updated_at,
             COALESCE(
               json_agg(json_build_object('id', p.id, 'name', p.name, 'imageUrl', p.image_url)
                 ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL),
               '[]'::json
             ) AS products
      FROM campaigns c
      LEFT JOIN campaign_products cp ON cp.campaign_id = c.id
      LEFT JOIN menu_products p ON p.id = cp.product_id
      GROUP BY c.id
      ORDER BY c.starts_on DESC, c.created_at DESC
    `) as unknown as CampaignRow[];

    return rows.map(toCampaign);
  }

  async getActiveForDate(date: string): Promise<Campaign | null> {
    const sql = getSql();
    const rows = (await sql`
      SELECT c.id, c.name, c.image_url, c.discount_percent, c.starts_on, c.ends_on,
             c.active, c.created_at, c.updated_at,
             json_agg(json_build_object('id', p.id, 'name', p.name, 'imageUrl', p.image_url)
               ORDER BY p.name) AS products
      FROM campaigns c
      INNER JOIN campaign_products cp ON cp.campaign_id = c.id
      INNER JOIN menu_products p ON p.id = cp.product_id
      WHERE c.active = TRUE
        AND c.starts_on <= ${date}::date
        AND c.ends_on >= ${date}::date
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 1
    `) as unknown as CampaignRow[];

    return rows.length > 0 ? toCampaign(rows[0]) : null;
  }

  async create(input: CampaignInput): Promise<Campaign> {
    const sql = getSql();
    await this.ensureNoConflict(input);
    const id = randomUUID();
    await sql.transaction([
      sql`
        INSERT INTO campaigns (
          id, name, image_url, product_id, discount_percent, starts_on, ends_on, active
        ) VALUES (
          ${id}, ${input.name.trim()}, ${input.imageUrl || null}, ${input.productIds[0]}, ${input.discountPercent},
          ${input.startsOn}::date, ${input.endsOn}::date, ${input.active}
        )
      `,
      ...input.productIds.map((productId) => sql`
        INSERT INTO campaign_products (campaign_id, product_id)
        VALUES (${id}, ${productId})
      `),
    ]);

    return this.get(id);
  }

  async update(id: string, input: CampaignInput): Promise<Campaign> {
    const sql = getSql();
    await this.get(id);
    await this.ensureNoConflict(input, id);
    await sql.transaction([
      sql`
        UPDATE campaigns
        SET name = ${input.name.trim()},
            image_url = ${input.imageUrl || null},
            product_id = ${input.productIds[0]},
            discount_percent = ${input.discountPercent},
            starts_on = ${input.startsOn}::date,
            ends_on = ${input.endsOn}::date,
            active = ${input.active},
            updated_at = now()
        WHERE id = ${id}
      `,
      sql`DELETE FROM campaign_products WHERE campaign_id = ${id}`,
      ...input.productIds.map((productId) => sql`
        INSERT INTO campaign_products (campaign_id, product_id)
        VALUES (${id}, ${productId})
      `),
    ]);

    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM campaigns
      WHERE id = ${id}
      RETURNING id
    `) as unknown as Array<{ id: string }>;

    if (rows.length === 0) {
      throw new CampaignNotFoundError("La campaña no existe.");
    }
  }

  private async get(id: string): Promise<Campaign> {
    const sql = getSql();
    const rows = (await sql`
      SELECT c.id, c.name, c.image_url, c.discount_percent, c.starts_on, c.ends_on,
             c.active, c.created_at, c.updated_at,
             COALESCE(
               json_agg(json_build_object('id', p.id, 'name', p.name, 'imageUrl', p.image_url)
                 ORDER BY p.name) FILTER (WHERE p.id IS NOT NULL),
               '[]'::json
             ) AS products
      FROM campaigns c
      LEFT JOIN campaign_products cp ON cp.campaign_id = c.id
      LEFT JOIN menu_products p ON p.id = cp.product_id
      WHERE c.id = ${id}
      GROUP BY c.id
    `) as unknown as CampaignRow[];

    if (rows.length === 0) throw new CampaignNotFoundError("La campaña no existe.");
    return toCampaign(rows[0]);
  }

  private async ensureNoConflict(input: CampaignInput, excludedId?: string) {
    if (!input.active) return;

    const sql = getSql();
    const rows = (await sql`
      SELECT id
      FROM campaigns
      WHERE active = TRUE
        AND starts_on <= ${input.endsOn}::date
        AND ends_on >= ${input.startsOn}::date
        ${excludedId ? sql`AND id <> ${excludedId}` : sql``}
      LIMIT 1
    `) as unknown as Array<{ id: string }>;

    if (rows.length > 0) {
      throw new CampaignDateConflictError(
        "Ya existe una campaña activa que se cruza con ese rango de fechas."
      );
    }
  }
}

export const campaignRepository = new CampaignRepository();
