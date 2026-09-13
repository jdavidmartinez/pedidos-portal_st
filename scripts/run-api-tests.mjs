import { spawn } from "node:child_process";
import { getTestDatabaseUrl } from "./lib/test-database-environment.cjs";

let testDatabaseUrl;
try {
  testDatabaseUrl = getTestDatabaseUrl();
} catch (error) {
  console.error(`[test:api] ${error.message}`);
  process.exit(2);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const migrate = spawn(npmCommand, ["run", "db:migrate:test"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEST_DATABASE_URL: testDatabaseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET || "api-test-secret-for-public-api",
  },
});

const migrateExitCode = await new Promise((resolve) => {
  migrate.on("close", resolve);
});

if (migrateExitCode !== 0) {
  process.exit(migrateExitCode ?? 1);
}

const tests = spawn(npmCommand, ["exec", "vitest", "run", "--", "--config", "vitest.integration.config.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEST_DATABASE_URL: testDatabaseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET || "api-test-secret-for-public-api",
  },
});

const testExitCode = await new Promise((resolve) => {
  tests.on("close", resolve);
});

process.exit(testExitCode ?? 1);
