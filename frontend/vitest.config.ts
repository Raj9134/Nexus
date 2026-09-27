// Standalone Vitest config. The app's vite.config.ts pulls in the TanStack
// Start / nitro SSR plugin stack, which is not wanted in a jsdom test run.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // The suite mocks fetch, so tests are not I/O bound and do not need this,
    // but a hung assertion should not stall the whole run.
    testTimeout: 10000,
  },
});
