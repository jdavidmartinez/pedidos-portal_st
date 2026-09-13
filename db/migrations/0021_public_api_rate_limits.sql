CREATE TABLE IF NOT EXISTS public_api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS public_api_rate_limits_expiry_idx
  ON public_api_rate_limits (expires_at);
