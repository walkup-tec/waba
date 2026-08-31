#!/usr/bin/env node
/**
 * Backup do diretório de dados de produção (volume /app/data).
 *
 * Uso no Easypanel (shell do container ou host com volume montado):
 *   node scripts/backup-production-data.mjs
 *   node scripts/backup-production-data.mjs --data-dir /app/data --out /app/data/_backups
 *
 * Uso local (espelhar produção copiada manualmente):
 *   node scripts/backup-production-data.mjs --data-dir D:\caminho\data
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function argValue(flag, fallback = "") {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || "").trim() || fallback;
}

const dataDir = path.resolve(argValue("--data-dir", path.join(root, "data")));
const outRoot = path.resolve(argValue("--out", path.join(dataDir, "_backups")));

if (!fs.existsSync(dataDir)) {
  console.error(`[backup] Diretório não encontrado: ${dataDir}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(outRoot, `backup-${stamp}`);

function copyRecursive(src, destDir) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === "_backups") continue;
      copyRecursive(path.join(src, name), path.join(destDir, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  fs.copyFileSync(src, destDir);
}

fs.mkdirSync(dest, { recursive: true });
const entries = fs.readdirSync(dataDir);
let files = 0;
for (const name of entries) {
  if (name === "_backups") continue;
  copyRecursive(path.join(dataDir, name), path.join(dest, name));
  files += 1;
}

const manifest = {
  createdAt: new Date().toISOString(),
  sourceDir: dataDir,
  entryCount: files,
  note: "Backup antes de deploy ou manutenção. Restaurar: copiar conteúdo de volta para /app/data.",
};
fs.writeFileSync(path.join(dest, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

console.log(JSON.stringify({ ok: true, backupDir: dest, entryCount: files }, null, 2));
