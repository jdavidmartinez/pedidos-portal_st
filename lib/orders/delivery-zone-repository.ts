import "server-only";

import { getSql } from "@/lib/db/neon";
import type { DeliveryZoneConfig } from "@/lib/orders/delivery-zones";

interface DeliveryZoneRow {
  code: DeliveryZoneConfig["code"];
  name: string;
  fee: number | string;
  active: boolean;
  sort_order: number | string;
}

function toDeliveryZone(row: DeliveryZoneRow): DeliveryZoneConfig {
  return {
    code: row.code,
    name: row.name,
    fee: Number(row.fee),
    active: row.active,
    sortOrder: Number(row.sort_order),
  };
}

class DeliveryZoneRepository {
  async list(activeOnly = false): Promise<DeliveryZoneConfig[]> {
    const sql = getSql();
    const rows = (await sql`
      SELECT code, name, fee, active, sort_order
      FROM delivery_zones
      WHERE ${activeOnly} = FALSE OR active = TRUE
      ORDER BY sort_order ASC, code ASC
    `) as unknown as DeliveryZoneRow[];
    return rows.map(toDeliveryZone);
  }

  async update(zone: DeliveryZoneConfig): Promise<DeliveryZoneConfig> {
    const sql = getSql();
    const rows = (await sql`
      UPDATE delivery_zones
      SET name = ${zone.name.trim()}, fee = ${zone.fee}, active = ${zone.active},
          sort_order = ${zone.sortOrder}, updated_at = now()
      WHERE code = ${zone.code}
      RETURNING code, name, fee, active, sort_order
    `) as unknown as DeliveryZoneRow[];
    return toDeliveryZone(rows[0]!);
  }
}

export const deliveryZoneRepository = new DeliveryZoneRepository();
