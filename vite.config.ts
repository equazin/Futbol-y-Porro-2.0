// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // VITE_BASE is set at build time for GitHub Pages (e.g. /Futbol-y-Porro-2.0/)
    base: process.env.VITE_BASE || "/",
  },
  tanstackStart: {
    server: { entry: "server" },
    // GitHub Pages can't run the SSR server, so emit a static SPA shell that
    // mounts the app on the client. Prerender every route to real HTML.
    spa: { enabled: true },
    // Prerender only the known static routes; don't crawl dynamic links
    // (e.g. /partidos/:id) which depend on the DB and 404 at build time.
    // Those routes still render client-side via the SPA shell fallback.
    prerender: { enabled: true, crawlLinks: false },
  },
});
