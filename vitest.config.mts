import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // "server-only" throws outside the React server runtime; tests run server code directly.
    alias: { "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
