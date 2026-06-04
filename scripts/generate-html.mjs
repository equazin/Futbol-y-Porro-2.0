#!/usr/bin/env node
/**
 * Genera index.html y 404.html para GitHub Pages leyendo los assets del build
 * directamente, sin depender del servidor SSR.
 */
import { writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE || "/";
const assetsDir = join(__dirname, "../dist/client/assets");
const outDir = join(__dirname, "../dist/client");

const assets = readdirSync(assetsDir);

const cssFile = assets.find((f) => f.startsWith("styles-") && f.endsWith(".css"));
const entryJs = assets.find((f) => f.startsWith("index-") && f.endsWith(".js"));

if (!cssFile) console.warn("  ⚠ No CSS file found");
if (!entryJs) console.warn("  ⚠ No entry JS found");

const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0f1a14">
  <title>Futbol y Porro FC — Futbol para siempre</title>
  <meta name="description" content="La app del Futbol y Porro FC. Un club de amigos, cultivo propio y responsable.">
  <meta property="og:title" content="Futbol y Porro FC">
  <meta property="og:description" content="Futbol para siempre. Un club de amigos, cultivo propio y responsable.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Futbol y Porro FC">
  <meta property="og:image" content="${base}og-image.jpg">
  <meta name="twitter:card" content="summary_large_image">
  ${cssFile ? `<link rel="stylesheet" href="${base}assets/${cssFile}">` : ""}
  <link rel="icon" type="image/svg+xml" href="${base}favicon.svg">
  <link rel="apple-touch-icon" href="${base}icon-192.png">
  <link rel="manifest" href="${base}manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
</head>
<body>
  ${entryJs ? `<script type="module" src="${base}assets/${entryJs}"></script>` : "<!-- entry JS not found -->"}
</body>
</html>`;

writeFileSync(join(outDir, "index.html"), html, "utf8");
writeFileSync(join(outDir, "404.html"), html, "utf8");

console.log(`  ✓ dist/client/index.html (base: ${base}, css: ${cssFile}, js: ${entryJs})`);
console.log("  ✓ dist/client/404.html");
