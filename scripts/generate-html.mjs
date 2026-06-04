#!/usr/bin/env node
/**
 * Post-build: calls the SSR server bundle to render the home page and saves
 * index.html + 404.html into dist/client/ for GitHub Pages deployment.
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// SSR background rendering errors are non-fatal — the client JS handles rendering.
process.on("unhandledRejection", (reason) => {
  console.warn("  ⚠ Background SSR warning (non-fatal):", reason?.message ?? reason);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const base = process.env.VITE_BASE || "/";
const url = `http://localhost${base}`;

console.log(`  Generating static HTML from ${url} ...`);

const serverPath = join(__dirname, "../dist/server/server.js");

let server;
try {
  server = require(serverPath).default;
} catch (err) {
  console.error("  ✗ Failed to load server bundle:", err.message);
  process.exit(1);
}

let html;
try {
  const response = await server.fetch(new Request(url), {}, {});
  html = await response.text();
} catch (err) {
  console.error("  ✗ Server fetch failed:", err.message);
  process.exit(1);
}

if (!html.includes("<html")) {
  console.error("  ✗ Response does not look like HTML:", html.substring(0, 200));
  process.exit(1);
}

const outDir = join(__dirname, "../dist/client");
writeFileSync(join(outDir, "index.html"), html, "utf8");
writeFileSync(join(outDir, "404.html"), html, "utf8");

console.log("  ✓ dist/client/index.html");
console.log("  ✓ dist/client/404.html");
