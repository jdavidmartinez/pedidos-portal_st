import { readFile } from "node:fs/promises";

async function readLocalDatabaseUrl() {
  try {
    const contents = await readFile(".env.local", "utf8");
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    return match?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
  } catch {
    return undefined;
  }
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const configuredDatabaseUrl =
  process.env.DATABASE_URL?.trim() || (await readLocalDatabaseUrl());

if (!testDatabaseUrl) {
  console.error("[db:test] TEST_DATABASE_URL no está configurada.");
  process.exit(2);
}

if (configuredDatabaseUrl && configuredDatabaseUrl === testDatabaseUrl) {
  console.error("[db:test] TEST_DATABASE_URL coincide con DATABASE_URL; se cancela por seguridad.");
  process.exit(2);
}

process.env.DATABASE_URL = testDatabaseUrl;
await import("./migrate-db.mjs");
