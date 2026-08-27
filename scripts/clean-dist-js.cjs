/**
 * Remove JS emitido em dist/ antes do tsc.
 * No Windows, overwrite de .js existente pode falhar com TS5033 UNKNOWN.
 * Não toca em dist/media nem em estáticos copiados (service worker).
 */
const fs = require("fs");
const path = require("path");

const distDir = path.join(process.cwd(), "dist");
const mediaDir = path.join(distDir, "media");
const keepNames = new Set(["sw-deploy-resilience.js"]);

function isInsideMedia(full) {
  const rel = path.relative(mediaDir, full);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (path.resolve(full) === path.resolve(mediaDir)) continue;
      walk(full);
      continue;
    }
    if (keepNames.has(ent.name)) continue;
    if (isInsideMedia(full)) continue;
    if (ent.name.endsWith(".js") || ent.name.endsWith(".js.map")) {
      try {
        fs.unlinkSync(full);
      } catch {
        /* arquivo pode estar em scan; tsc tentará criar de novo */
      }
    }
  }
}

walk(distDir);
