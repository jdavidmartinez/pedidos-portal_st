import { spawn } from "node:child_process";
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
  console.error("[test:api] TEST_DATABASE_URL no está configurada.");
  console.error("[test:api] Crea .env.test con una base Neon exclusiva para pruebas.");
  process.exit(2);
}

if (configuredDatabaseUrl && configuredDatabaseUrl === testDatabaseUrl) {
  console.error("[test:api] TEST_DATABASE_URL coincide con DATABASE_URL; se cancela por seguridad.");
  process.exit(2);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const migrate = spawn(npmCommand, ["run", "db:migrate:test"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEST_DATABASE_URL: testDatabaseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET || "api-test-secret",
  },
});

const migrateExitCode = await new Promise((resolve) => {
  migrate.on("close", resolve);
});

if (migrateExitCode !== 0) {
  process.exit(migrateExitCode ?? 1);
}

const tests = spawn(npmCommand, ["exec", "vitest", "run", "tests/integration"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET || "api-test-secret",
  },
});

const testExitCode = await new Promise((resolve) => {
  tests.on("close", resolve);
});

process.exit(testExitCode ?? 1);
