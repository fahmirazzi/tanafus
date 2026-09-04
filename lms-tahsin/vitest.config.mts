import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit test berjalan di Node murni tanpa DOM: yang diuji adalah aturan
 * bisnis di src/lib (tarif, transisi status, agregasi progres), bukan
 * render komponen. Alias "@" disamakan dengan tsconfig paths.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
