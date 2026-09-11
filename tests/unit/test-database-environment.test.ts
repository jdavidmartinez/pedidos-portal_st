import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "../../scripts/lib/database-environment.mjs";
import { getTestDatabaseUrl } from "../../scripts/lib/test-database-environment.cjs";

const testUrl = "postgresql://tester:private-sentinel@ep-testing-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";
const devUrl = testUrl.replace("ep-testing", "ep-development");
const protectedNames = ["DATABASE_URL", "DEV_DATABASE_URL", "PRODUCTION_DATABASE_URL", "RECOVERY_DATABASE_URL"];
const directories: string[] = [];
function temporaryRoot() {
  const directory = mkdtempSync(join(tmpdir(), "portal-db-guard-"));
  directories.push(directory);
  return { directory, url: pathToFileURL(`${directory}/`) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("test database isolation", () => {
  it("accepts an isolated target without requiring production credentials", () => {
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DEV_DATABASE_URL: devUrl })).toBe(testUrl);
  });

  it.each([undefined, "", "   ", "not-a-url", "https://example.com/db", "postgresql:///db", "postgresql://localhost/", "postgresql://localhost/%ZZ"])("rejects missing or invalid target %s", (value) => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: value })).toThrow(/TEST_DATABASE_URL/);
  });

  it.each(protectedNames)("rejects %s even with different role, password, pooling, port spelling and query options", (name) => {
    const sameDatabase = "postgres://other:different@ep-testing.us-east-2.aws.neon.tech:5432/%6Eeondb?sslmode=verify-full";
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, [name]: sameDatabase })).toThrow(`coincide con ${name}`);
  });

  it("rejects Vercel Production", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, VERCEL_ENV: "production" })).toThrow("Vercel Production");
  });

  it("rejects malformed protected connections without exposing secrets", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DEV_DATABASE_URL: "private-sentinel" })).toThrow("DEV_DATABASE_URL no contiene una URL válida");
  });

  it("does not expose URLs or credentials in collision errors", () => {
    try {
      resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DATABASE_URL: testUrl });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("private-sentinel");
      expect(String(error)).not.toContain("ep-testing");
    }
  });

  it.each([".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local", ".env.recovery", ".env.test"])("checks %s independently of process overrides and parses dotenv syntax", (file) => {
    const root = temporaryRoot();
    writeFileSync(join(root.directory, file), `export DEV_DATABASE_URL = '${testUrl}' # protected\n`);
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DEV_DATABASE_URL: devUrl }, root.url)).toThrow("coincide con DEV_DATABASE_URL");
  });

  it("does not load local secrets into the process environment", () => {
    const root = temporaryRoot();
    writeFileSync(join(root.directory, ".env.local"), `DEV_DATABASE_URL='${devUrl}'\nGUARD_TEST_SECRET=private-sentinel\n`);
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: testUrl }, root.url)).toBe(testUrl);
    expect(process.env.GUARD_TEST_SECRET).toBeUndefined();
  });

  it("fails closed when a protected file cannot be read", () => {
    const root = temporaryRoot();
    mkdirSync(join(root.directory, ".env.local"));
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: testUrl }, root.url)).toThrow("No fue posible leer .env.local");
  });

  it.each(["scripts/run-api-tests.mjs", "scripts/migrate-test-db.mjs"])("%s exits before starting migrations or connecting", (script) => {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, TEST_DATABASE_URL: testUrl, DEV_DATABASE_URL: testUrl, VERCEL_ENV: "development" },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("se cancela antes de conectar");
    expect(result.stderr).not.toContain("private-sentinel");
    expect(result.stdout).not.toContain("[db]");
    expect(result.stdout).not.toContain("vitest");
  });
});
