CREATE TABLE IF NOT EXISTS blob_orphan_observations (
  url TEXT PRIMARY KEY,
  pathname TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blob_orphan_observations_first_seen_idx
  ON blob_orphan_observations (first_seen_at);
