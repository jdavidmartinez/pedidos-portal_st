import { getTestDatabaseUrl } from "./lib/test-database-environment.cjs";

try {
  process.env.DATABASE_URL = getTestDatabaseUrl();
} catch (error) {
  console.error(`[db:test] ${error.message}`);
  process.exit(2);
}
await import("./migrate-db.mjs");
