import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("[db] DATABASE_URL no está configurada.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const currentFile = fileURLToPath(import.meta.url);
const migrationsDirectory = path.resolve(
  path.dirname(currentFile),
  "../db/migrations"
);

function splitStatements(contents) {
  return contents
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

await sql.query(
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  []
);

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const migrationFile of migrationFiles) {
  const version = migrationFile.replace(/\.sql$/, "");
  const appliedRows = await sql`
    SELECT version FROM schema_migrations WHERE version = ${version}
  `;

  if (appliedRows.length > 0) {
    console.log(`[db] ${version} ya estaba aplicada.`);
    continue;
  }

  const contents = await readFile(
    path.join(migrationsDirectory, migrationFile),
    "utf8"
  );

  console.log(`[db] Aplicando ${version}...`);
  for (const statement of splitStatements(contents)) {
    await sql.query(statement, []);
  }

  await sql`
    INSERT INTO schema_migrations (version) VALUES (${version})
  `;
  console.log(`[db] ${version} aplicada.`);
}

console.log("[db] Migraciones completadas.");
