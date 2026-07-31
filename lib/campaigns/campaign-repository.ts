import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/neon";
import type { CampaignInput } from "@/lib/campaigns/campaign-schema";

export interface Campaign {
  id: string;
  name: string;
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
  return {
    id: row.id,
    name: row.name,
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
      SELECT id, name, discount_percent, starts_on, ends_on, active,
             created_at, updated_at
      FROM campaigns
      ORDER BY starts_on DESC, created_at DESC
    `) as unknown as CampaignRow[];

    return rows.map(toCampaign);
  }

  async getActiveForDate(date: string): Promise<Campaign | null> {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, name, discount_percent, starts_on, ends_on, active,
             created_at, updated_at
      FROM campaigns
      WHERE active = TRUE
        AND starts_on <= ${date}::date
        AND ends_on >= ${date}::date
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as CampaignRow[];

    return rows.length > 0 ? toCampaign(rows[0]) : null;
  }

  async create(input: CampaignInput): Promise<Campaign> {
    const sql = getSql();
    await this.ensureNoConflict(input);
    const id = randomUUID();
    const rows = (await sql`
      INSERT INTO campaigns (
        id, name, discount_percent, starts_on, ends_on, active
      ) VALUES (
        ${id}, ${input.name.trim()}, ${input.discountPercent},
        ${input.startsOn}::date, ${input.endsOn}::date, ${input.active}
      )
      RETURNING id, name, discount_percent, starts_on, ends_on, active,
                created_at, updated_at
    `) as unknown as CampaignRow[];

    return toCampaign(rows[0]);
  }

  async update(id: string, input: CampaignInput): Promise<Campaign> {
    const sql = getSql();
    await this.get(id);
    await this.ensureNoConflict(input, id);
    const rows = (await sql`
      UPDATE campaigns
      SET name = ${input.name.trim()},
          discount_percent = ${input.discountPercent},
          starts_on = ${input.startsOn}::date,
          ends_on = ${input.endsOn}::date,
          active = ${input.active},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, discount_percent, starts_on, ends_on, active,
                created_at, updated_at
    `) as unknown as CampaignRow[];

    return toCampaign(rows[0]);
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
      SELECT id, name, discount_percent, starts_on, ends_on, active,
             created_at, updated_at
      FROM campaigns
      WHERE id = ${id}
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
