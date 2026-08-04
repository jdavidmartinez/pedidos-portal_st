import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Neon puede reactivar el compute entre consultas; los flujos de integración
    // realizan varias operaciones reales y necesitan tolerar esa latencia remota.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
