#!/usr/bin/env node
/**
 * Prepara dist/client para GitHub Pages.
 *
 * TanStack Start (modo SPA) genera `_shell.html`: un shell HTML real que monta
 * la app en el cliente, con el manifest del router y los assets ya resueltos
 * contra VITE_BASE. GitHub Pages sirve `index.html` en la raíz y `404.html`
 * como fallback para rutas profundas, así que copiamos el shell a ambos.
 */
import { copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../dist/client");
const shell = join(outDir, "_shell.html");

if (!existsSync(shell)) {
  console.error("  ✗ No se encontró dist/client/_shell.html. ¿Está habilitado spa.enabled en vite.config.ts?");
  process.exit(1);
}

// index.html: home de la SPA. 404.html: fallback para deep links en GitHub Pages.
copyFileSync(shell, join(outDir, "index.html"));
copyFileSync(shell, join(outDir, "404.html"));

console.log("  ✓ dist/client/index.html (desde _shell.html)");
console.log("  ✓ dist/client/404.html (SPA fallback)");
