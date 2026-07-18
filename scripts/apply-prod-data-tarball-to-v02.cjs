/**
 * Aplica tarball de produção (artifact Export Production Data) em data/v02.
 *
 * Uso:
 *   node scripts/apply-prod-data-tarball-to-v02.cjs path\to\waba-prod-data-*.tgz
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const V02_DIR = process.env.WABA_V02_DATA_DIR
  ? path.resolve(process.env.WABA_V02_DATA_DIR)
  : path.join(ROOT, "data", "v02");

const tarPath = path.resolve(process.argv[2] || "");
if (!tarPath || !fs.existsSync(tarPath)) {
  console.error("Uso: node scripts/apply-prod-data-tarball-to-v02.cjs <arquivo.tgz>");
  process.exit(1);
}

fs.mkdirSync(V02_DIR, { recursive: true });
const backupDir = path.join(
  V02_DIR,
  "_backups",
  `pre-tarball-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
fs.mkdirSync(backupDir, { recursive: true });
for (const name of fs.readdirSync(V02_DIR)) {
  if (name === "_backups" || name === "vps-infra") continue;
  const src = path.join(V02_DIR, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(backupDir, name));
}
console.log(`Backup: ${backupDir}`);

// Prefer tar.exe (Windows 10+) or bsdtar
const extract = () => {
  const tries = [
    ["tar", ["-xzf", tarPath, "-C", V02_DIR]],
    ["bsdtar", ["-xzf", tarPath, "-C", V02_DIR]],
  ];
  let lastErr;
  for (const [bin, args] of tries) {
    try {
      execFileSync(bin, args, { stdio: "inherit" });
      return;
    } catch (error) {
      lastErr = error;
    }
  }
  throw lastErr || new Error("tar não disponível");
};

extract();

const desiredPath = path.join(V02_DIR, "aquecedor-desired-owners.json");
fs.writeFileSync(
  desiredPath,
  `${JSON.stringify(
    {
      version: 1,
      savedAt: new Date().toISOString(),
      desired: {},
      note: "Zerado no apply produção→V02 local para não duplicar envios no EVO.",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const files = fs.readdirSync(V02_DIR).filter((n) => n.endsWith(".json"));
console.log(`\nOK: ${files.length} JSON em ${V02_DIR}`);
console.log(
  "Lembrete: ENABLE_AQUECEDOR_PROCESSING=false e ENABLE_BACKGROUND_PROCESSING=false no .env.v02.",
);
