import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db/neon";
import { hashPassword } from "./password";
import { recoveryEmailConfig, sendRecoveryEmail } from "./recovery-email";

export const RECOVERY_MESSAGE = "Si el correo está registrado, recibirás un enlace para cambiar tu contraseña.";
export const INVALID_RESET_MESSAGE = "El enlace no es válido o ha vencido. Solicita uno nuevo.";
export function resetTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function validResetToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function requestPasswordRecovery(email: string) {
  recoveryEmailConfig();
  const sql = getSql();
  const token = randomBytes(32).toString("base64url");
  const digest = resetTokenHash(token);
  const rows = await sql`
    INSERT INTO auth_password_resets (token_hash, user_id, expires_at)
    SELECT ${digest}, id, now() + interval '15 minutes' FROM auth_users
    WHERE lower(recovery_email) = ${email.trim().toLowerCase()} AND active = TRUE
    RETURNING user_id
  ` as unknown as Array<{ user_id: string }>;
  if (!rows.length) return;
  try { await sendRecoveryEmail(email.trim().toLowerCase(), token); }
  catch {
    await sql`DELETE FROM auth_password_resets WHERE token_hash = ${digest}`;
    throw new Error("PasswordRecoveryEmailFailed");
  }
}

export async function finishPasswordRecovery(token: string, password: string) {
  const sql = getSql();
  const digest = resetTokenHash(token);
  const passwordHash = await hashPassword(password);
  // Shared lock serializes password resets and ordinary password changes.
  // One statement claims the token, updates the password and revokes sessions.
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(982451654)`,
    sql`
      WITH claimed AS (
        DELETE FROM auth_password_resets r USING auth_users u
        WHERE r.token_hash = ${digest} AND r.expires_at > now()
          AND u.id = r.user_id AND u.active = TRUE
        RETURNING r.user_id
      ), changed AS (
        UPDATE auth_users SET password_hash = ${passwordHash}, updated_at = now()
        WHERE id IN (SELECT user_id FROM claimed) RETURNING id
      ), revoked AS (
        DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM changed)
      ), invalidated AS (
        DELETE FROM auth_password_resets WHERE user_id IN (SELECT id FROM changed) AND token_hash <> ${digest}
      ) SELECT id FROM changed
    `,
    sql`DELETE FROM auth_password_resets WHERE expires_at <= now()`,
  ]) as unknown as unknown[][];
  return results[1].length > 0;
}
