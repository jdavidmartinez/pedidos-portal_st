CREATE TABLE IF NOT EXISTS delivery_zones (
  code TEXT PRIMARY KEY CHECK (code IN ('zone_1', 'zone_2', 'zone_3', 'zone_4')),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  fee INTEGER NOT NULL CHECK (fee >= 0 AND fee <= 1000000),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0 AND sort_order <= 10000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO delivery_zones (code, name, fee, active, sort_order)
VALUES
  ('zone_1', 'Zona 1 — Villa Claudia y sur cercano', 4000, TRUE, 1),
  ('zone_2', 'Zona 2 — Centro y oriente', 6000, TRUE, 2),
  ('zone_3', 'Zona 3 — Occidente', 6000, TRUE, 3),
  ('zone_4', 'Zona 4 — Norte', 8000, TRUE, 4)
ON CONFLICT (code) DO NOTHING;
