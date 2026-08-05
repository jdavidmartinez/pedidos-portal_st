import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

async function readLocalDatabaseUrl() {
  try {
    const contents = await readFile(".env.local", "utf8");
    const match = contents.match(/^DATABASE_URL=(.*)$/m);
    return match?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
  } catch {
    return undefined;
  }
}

const recoveryDatabaseUrl = process.env.RECOVERY_DATABASE_URL?.trim();
const productionDatabaseUrl = process.env.DATABASE_URL?.trim() || await readLocalDatabaseUrl();

function databaseIdentity(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/-pooler(?=\.)/, "");
    return `${decodeURIComponent(url.username)}@${host}${url.pathname}`;
  } catch {
    return value;
  }
}

if (!recoveryDatabaseUrl) {
  console.error("[db:recovery] RECOVERY_DATABASE_URL no está configurada.");
  process.exit(2);
}

if (
  process.env.VERCEL_ENV === "production" ||
  (productionDatabaseUrl && databaseIdentity(recoveryDatabaseUrl) === databaseIdentity(productionDatabaseUrl))
) {
  console.error("[db:recovery] RECOVERY_DATABASE_URL coincide con DATABASE_URL; se cancela por seguridad.");
  process.exit(2);
}

const currentFile = fileURLToPath(import.meta.url);
const migrationsDirectory = path.resolve(path.dirname(currentFile), "../db/migrations");
const expectedMigrations = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .map((file) => file.replace(/\.sql$/, ""))
  .sort();

const sql = neon(recoveryDatabaseUrl);
const migrationRows = await sql`
  SELECT version
  FROM schema_migrations
  ORDER BY version
`;
const appliedMigrations = new Set(migrationRows.map((row) => String(row.version)));
const missingMigrations = expectedMigrations.filter((version) => !appliedMigrations.has(version));

const requiredTables = [
  "orders",
  "order_items",
  "menu_categories",
  "menu_products",
  "campaigns",
  "campaign_products",
  "auth_users",
  "auth_sessions",
  "order_edits",
  "blob_orphan_observations",
];
const tableRows = await sql.query(
  `SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [requiredTables]
);
const existingTables = new Set(tableRows.map((row) => String(row.table_name)));
const missingTables = requiredTables.filter((table) => !existingTables.has(table));

const [integrity] = await sql`
  SELECT
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM order_items) AS order_items,
    (SELECT count(*)::int FROM menu_products WHERE active = true) AS active_products,
    (SELECT count(*)::int FROM auth_users WHERE active = true) AS active_users,
    (SELECT count(*)::int
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.order_id IS NULL) AS orders_without_items,
    (SELECT max(received_at) FROM orders) AS latest_order_at
`;

console.log("[db:recovery] Verificación de solo lectura completada.");
console.log(JSON.stringify({
  expectedMigrations: expectedMigrations.length,
  appliedMigrations: appliedMigrations.size,
  missingMigrations,
  missingTables,
  counts: {
    orders: integrity.orders,
    orderItems: integrity.order_items,
    activeProducts: integrity.active_products,
    activeUsers: integrity.active_users,
    ordersWithoutItems: integrity.orders_without_items,
  },
  latestOrderAt: integrity.latest_order_at,
}, null, 2));

if (missingMigrations.length || missingTables.length || Number(integrity.orders_without_items) > 0) {
  console.error("[db:recovery] La rama restaurada no cumple la línea base esperada.");
  process.exit(1);
}

console.log("[db:recovery] Rama restaurada apta para continuar el simulacro.");
