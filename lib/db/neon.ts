import "server-only";

import { neon } from "@neondatabase/serverless";

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL no está configurada.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let sqlClient: ReturnType<typeof neon> | undefined;
let sqlClientUrl: string | undefined;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new DatabaseNotConfiguredError();
  }

  if (!sqlClient || sqlClientUrl !== databaseUrl) {
    sqlClient = neon(databaseUrl);
    sqlClientUrl = databaseUrl;
  }

  return sqlClient;
}
