import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `@/…`-Alias wie in tsconfig.json auflösen, damit die getesteten Module ihre
// Imports finden. Tests laufen als reine Node-Unit-Tests (keine DB, kein Next).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, ""),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
