/* eslint-disable @typescript-eslint/no-require-imports -- Playwright loads its TS config as CommonJS; keep this shared guard compatible with both runners. */
const { readFileSync } = require("node:fs");
const { parseEnv } = require("node:util");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
const { resolveTestDatabaseUrl } = require("./database-environment.mjs");

const projectRoot = pathToFileURL(`${resolve(__dirname, "../..")}/`);
const protectedFiles = [
  ".env", ".env.local", ".env.development", ".env.development.local",
  ".env.production", ".env.production.local", ".env.recovery", ".env.test",
];

/** Read without applying local secrets to process.env or printing their values.
 * @param {Record<string, string | undefined>} environment
 * @param {URL} root
 */
function getTestDatabaseUrl(environment = process.env, root = projectRoot) {
  const sources = protectedFiles.map((name) => {
    try {
      return parseEnv(readFileSync(new URL(name, root), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw new Error(`No fue posible leer ${name}; se cancelan las pruebas.`);
    }
  });
  return resolveTestDatabaseUrl(environment, sources);
}

module.exports = { getTestDatabaseUrl };
