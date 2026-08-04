import { neon } from "@neondatabase/serverless";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import {
  E2E_ADMIN_USERNAME,
  E2E_KITCHEN_USERNAME,
  E2E_PASSWORD,
} from "./test-identity";

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export default async function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL debe apuntar a la base Neon exclusiva para ejecutar E2E."
    );
  }

  const sql = neon(databaseUrl);
  const passwordHash = await hashPassword(E2E_PASSWORD);
  await sql`
    INSERT INTO auth_users (id, username, password_hash, role, active)
    VALUES
      (gen_random_uuid(), ${E2E_KITCHEN_USERNAME}, ${passwordHash}, 'kitchen', TRUE),
      (gen_random_uuid(), ${E2E_ADMIN_USERNAME}, ${passwordHash}, 'admin', TRUE)
    ON CONFLICT (lower(username)) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      active = TRUE,
      updated_at = now()
  `;
}
