export const DELIVERY_ZONES = ["zone_1", "zone_2", "zone_3", "zone_4"] as const;

export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

export interface DeliveryZoneConfig {
  code: DeliveryZone;
  name: string;
  fee: number;
  active: boolean;
  sortOrder: number;
}

export const DEFAULT_DELIVERY_ZONES: DeliveryZoneConfig[] = [
  { code: "zone_1", name: "Zona 1 — Villa Claudia y sur cercano", fee: 4_000, active: true, sortOrder: 1 },
  { code: "zone_2", name: "Zona 2 — Centro y oriente", fee: 6_000, active: true, sortOrder: 2 },
  { code: "zone_3", name: "Zona 3 — Occidente", fee: 6_000, active: true, sortOrder: 3 },
  { code: "zone_4", name: "Zona 4 — Norte", fee: 8_000, active: true, sortOrder: 4 },
];
