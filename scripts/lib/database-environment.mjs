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
