function databaseIdentity(value) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    // Roles, passwords and connection options do not identify a database.
    return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
  } catch {
    return value;
  }
}

function requirePostgresUrl(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} no está configurada.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} no contiene una URL válida.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${variableName} debe ser una conexión PostgreSQL.`);
  }

  if (!url.hostname || !url.pathname.slice(1) || url.hash) {
    throw new Error(`${variableName} debe incluir un servidor y una base válidos.`);
  }
  try {
    decodeURIComponent(url.pathname);
  } catch {
    throw new Error(`${variableName} no contiene una URL válida.`);
  }

  return value;
}

/**
 * @param {Record<string, string | undefined>} environment
 */
export function resolveDevelopmentDatabaseUrl(environment = process.env) {
  if (environment.VERCEL_ENV === "production") {
    throw new Error(
      "Los comandos de desarrollo no pueden ejecutarse en Vercel Production."
    );
  }

  const developmentUrl = requirePostgresUrl(
    environment.DEV_DATABASE_URL?.trim(),
    "DEV_DATABASE_URL"
  );
  const developmentIdentity = databaseIdentity(developmentUrl);

  const protectedVariables = [
    "TEST_DATABASE_URL",
    "RECOVERY_DATABASE_URL",
    "PRODUCTION_DATABASE_URL",
  ];

  for (const variableName of protectedVariables) {
    const protectedUrl = environment[variableName]?.trim();
    if (
      protectedUrl &&
      databaseIdentity(protectedUrl) === developmentIdentity
    ) {
      throw new Error(
        `DEV_DATABASE_URL coincide con ${variableName}; se cancela por seguridad.`
      );
    }
  }

  return developmentUrl;
}

export { databaseIdentity };

/**
 * Validate before assigning DATABASE_URL or creating any database client.
 * Each protected source is checked independently: process overrides must not
 * hide a protected connection stored in a local environment file.
 * @param {Record<string, string | undefined>} environment
 * @param {Array<Record<string, string | undefined>>} protectedEnvironments
 */
export function resolveTestDatabaseUrl(environment = process.env, protectedEnvironments = []) {
  const sources = [environment, ...protectedEnvironments];
  if (environment.VERCEL_ENV === "production") {
    throw new Error("Las pruebas no pueden ejecutarse en Vercel Production.");
  }
  const testUrl = requirePostgresUrl(environment.TEST_DATABASE_URL?.trim(), "TEST_DATABASE_URL");
  const testIdentity = databaseIdentity(testUrl);
  for (const source of sources) {
    for (const name of ["DATABASE_URL", "DEV_DATABASE_URL", "PRODUCTION_DATABASE_URL", "RECOVERY_DATABASE_URL"]) {
      const value = source[name]?.trim();
      if (!value) continue;
      requirePostgresUrl(value, name);
      if (databaseIdentity(value) === testIdentity) {
        throw new Error(`TEST_DATABASE_URL coincide con ${name}; se cancela antes de conectar.`);
      }
    }
  }
  return testUrl;
}
