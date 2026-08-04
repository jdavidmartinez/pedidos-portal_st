import { neon } from "@neondatabase/serverless";
import {
  E2E_ADMIN_USERNAME,
  E2E_KITCHEN_USERNAME,
} from "./test-identity";

export default async function globalTeardown() {
  const databaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl) return;

  const sql = neon(databaseUrl);
  await sql`
    DELETE FROM auth_users
    WHERE username IN (${E2E_KITCHEN_USERNAME}, ${E2E_ADMIN_USERNAME})
  `;
}
