ALTER TABLE auth_users ADD COLUMN recovery_email TEXT;
CREATE UNIQUE INDEX auth_users_recovery_email_unique ON auth_users (lower(recovery_email)) WHERE recovery_email IS NOT NULL;
CREATE TABLE auth_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_password_resets_user_idx ON auth_password_resets (user_id);
CREATE INDEX auth_password_resets_expiry_idx ON auth_password_resets (expires_at);
