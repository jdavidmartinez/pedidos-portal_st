import { resolveDevelopmentDatabaseUrl } from "./lib/database-environment.mjs";

try {
  process.env.DATABASE_URL = resolveDevelopmentDatabaseUrl();
  console.log("[db:dev] Conexión de desarrollo validada.");
  await import("./migrate-db.mjs");
} catch (error) {
  console.error(`[db:dev] ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}
