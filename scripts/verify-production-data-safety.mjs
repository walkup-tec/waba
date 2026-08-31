#!/usr/bin/env node
/**
 * Verifica se o ambiente está configurado para NÃO perder dados no deploy.
 * Rode antes de publicar ou no CI (opcional).
 *
 *   node scripts/verify-production-data-safety.mjs
 *   node scripts/verify-production-data-safety.mjs --data-dir /app/data
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
const ftpBundleData = path.join(root, "ftp-bundle", "data");

const issues = [];
const warnings = [];

if (fs.existsSync(ftpBundleData)) {
  const entries = fs.readdirSync(ftpBundleData).filter((n) => n !== ".gitkeep" && !n.startsWith("."));
  if (entries.length > 0) {
    issues.push(
      `ftp-bundle/data contém ${entries.length} item(ns) — risco de sobrescrever produção no deploy FTP. Rode bundle:ftp após correção (data/ vazio no bundle).`,
    );
  }
}

if (!fs.existsSync(dataDir)) {
  warnings.push(`dataDir ausente (${dataDir}) — OK em build CI; em produção monte volume /app/data.`);
} else {
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch {
    issues.push(`dataDir sem permissão de escrita: ${dataDir}`);
  }
}

const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
if (/COPY\s+data\//i.test(dockerfile)) {
  issues.push("Dockerfile contém COPY data/ — imagem não deve embutir dados de produção.");
}

const result = {
  ok: issues.length === 0,
  issues,
  warnings,
  checks: {
    dataDir,
    ftpBundleDataChecked: fs.existsSync(ftpBundleData),
    dockerfileScanned: true,
  },
};

console.log(JSON.stringify(result, null, 2));
process.exit(issues.length ? 1 : 0);
