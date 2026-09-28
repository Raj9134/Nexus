// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },

  /*
    The shared config defaults to the Cloudflare Workers preset, which produces a
    wrangler bundle rather than a server. That is the wrong shape for Railway,
    where a Node service expects a process to start and a port to listen on.

    The preset is only forced to cloudflare-module inside Lovable's own build
    sandbox, so setting it here is honoured on a normal `npm run build`.
  */
  nitro: {
    preset: "node-server",
  },
});

// Vitest has its own config (vitest.config.ts) rather than a `test` key here,
// because this config's types only describe the TanStack Start options and the
// SSR plugin stack is not wanted in a jsdom run anyway.
