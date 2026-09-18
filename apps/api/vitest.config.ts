import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^#\//, replacement: `${srcDir}/` }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/fresh-database.ts"],
    // Each file gets its own process, so the module-level `db` singleton in
    // src/db/index.ts picks up that file's DATABASE_URL.
    pool: "forks",
  },
});
