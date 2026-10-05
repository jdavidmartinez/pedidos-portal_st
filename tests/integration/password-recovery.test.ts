import { afterAll, beforeAll, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getTestDatabaseUrl } from "../../scripts/lib/test-database-environment.cjs";
import { finishPasswordRecovery, resetTokenHash } from "@/lib/auth/password-recovery";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { authRepository } from "@/lib/auth/auth-repository";
const databaseUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;
const sql = neon(databaseUrl);
const id = randomUUID();
const newToken = () => randomBytes(32).toString("base64url");
const password = "NewPassword123!";
beforeAll(async () => {
  await sql`INSERT INTO auth_users (id, username, password_hash, role) VALUES (${id}, ${`recovery-${id}`}, ${await hashPassword("OldPassword123!")}, 'kitchen')`;
});
afterAll(async () => { await sql`DELETE FROM auth_users WHERE id = ${id}`; });
async function insertToken(token: string, expired = false) {
  await sql`INSERT INTO auth_password_resets (token_hash, user_id, expires_at) VALUES (${resetTokenHash(token)}, ${id}, ${new Date(Date.now() + (expired ? -60000 : 900000)).toISOString()})`;
}
it("allows exactly one concurrent claim, revokes sessions and invalidates other links", async () => {
  const token = newToken(), other = newToken();
  await insertToken(token); await insertToken(other);
  const session = await authRepository.createSession(id);
  const results = await Promise.all([finishPasswordRecovery(token, password), finishPasswordRecovery(token, password)]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await authRepository.getSession(session)).toBeNull();
  expect(await finishPasswordRecovery(other, password)).toBe(false);
  const rows = await sql`SELECT password_hash FROM auth_users WHERE id = ${id}`;
  expect(await verifyPassword(password, rows[0].password_hash)).toBe(true);
});
it("rejects expired tokens and inactive accounts", async () => {
  const expired = newToken(), inactive = newToken();
  await insertToken(expired, true); await insertToken(inactive);
  expect(await finishPasswordRecovery(expired, password)).toBe(false);
  await sql`UPDATE auth_users SET active = FALSE WHERE id = ${id}`;
  expect(await finishPasswordRecovery(inactive, password)).toBe(false);
  await sql`UPDATE auth_users SET active = TRUE WHERE id = ${id}`;
});
it("admin password changes invalidate pending recovery links", async () => {
  const token = newToken(); await insertToken(token);
  await authRepository.resetPassword(id, "AdminReset123!");
  expect(await finishPasswordRecovery(token, password)).toBe(false);
});
