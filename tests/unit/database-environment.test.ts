import { describe, expect, it } from "vitest";
import {
  databaseIdentity,
  resolveDevelopmentDatabaseUrl,
} from "../../scripts/lib/database-environment.mjs";

const developmentUrl =
  "postgresql://portal:secret@ep-development-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("database environment safeguards", () => {
  it("accepts an isolated PostgreSQL development URL", () => {
    expect(
      resolveDevelopmentDatabaseUrl({ DEV_DATABASE_URL: developmentUrl })
    ).toBe(developmentUrl);
  });

  it("requires DEV_DATABASE_URL", () => {
    expect(() => resolveDevelopmentDatabaseUrl({})).toThrow(
      "DEV_DATABASE_URL no está configurada"
    );
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() =>
      resolveDevelopmentDatabaseUrl({ DEV_DATABASE_URL: "https://example.com" })
    ).toThrow("debe ser una conexión PostgreSQL");
  });

  it("blocks execution in Vercel Production", () => {
    expect(() =>
      resolveDevelopmentDatabaseUrl({
        DEV_DATABASE_URL: developmentUrl,
        VERCEL_ENV: "production",
      })
    ).toThrow("Vercel Production");
  });

  it("rejects the same database used by testing", () => {
    expect(() =>
      resolveDevelopmentDatabaseUrl({
        DEV_DATABASE_URL: developmentUrl,
        TEST_DATABASE_URL: developmentUrl.replace("-pooler", ""),
      })
    ).toThrow("coincide con TEST_DATABASE_URL");
  });

  it("normalizes pooled and direct Neon endpoints", () => {
    expect(databaseIdentity(developmentUrl)).toBe(
      databaseIdentity(developmentUrl.replace("-pooler", ""))
    );
  });
});
