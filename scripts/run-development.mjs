import { spawn } from "node:child_process";
import { resolveDevelopmentDatabaseUrl } from "./lib/database-environment.mjs";

let developmentUrl;
try {
  developmentUrl = resolveDevelopmentDatabaseUrl();
} catch (error) {
  console.error(`[dev] ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}

console.log("[dev] Usando la base de datos exclusiva de desarrollo.");

const next = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: developmentUrl,
    },
  }
);

next.on("error", (error) => {
  console.error(`[dev] No fue posible iniciar Next.js: ${error.message}`);
  process.exit(1);
});

next.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
