/**
 * Espelha dados de produção → data/v02 local.
 *
 * Uso:
 *   node scripts/pull-production-data-to-v02.cjs
 *   node scripts/pull-production-data-to-v02.cjs --base https://waba.draxsistemas.com.br
 *
 * Pré-requisitos:
 *   - .env.v02 com WABA_ADMIN_EMAIL / WABA_ADMIN_PASSWORD (mesmos da produção)
 *   - Produção com GET /admin/infra/data-snapshot (deploy recente)
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const ROOT = path.join(__dirname, "..");
const V02_DIR = process.env.WABA_V02_DATA_DIR
  ? path.resolve(process.env.WABA_V02_DATA_DIR)
  : path.join(ROOT, "data", "v02");

dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env") });

const getArg = (flag) => {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || "").trim();
};

const base = (getArg("--base") || "https://waba.draxsistemas.com.br").replace(/\/+$/, "");
const email = String(process.env.WABA_ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.WABA_ADMIN_PASSWORD || "").trim();

if (!email || !password) {
  console.error("Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD em .env.v02");
  process.exit(1);
}

const writeJsonAtomic = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
};

const pickCookie = (response) => {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers
      .getSetCookie()
      .map((row) => String(row).split(";")[0].trim())
      .filter(Boolean)
      .join("; ");
  }
  const raw = String(response.headers.get("set-cookie") || "");
  return raw
    .split(/,(?=[^;]+?=)/)
    .map((row) => row.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
};

(async () => {
  console.log(`Login master em ${base} ...`);
  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    console.error("Login falhou:", loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const cookie = pickCookie(loginRes);
  if (!cookie) {
    console.error("Cookie de sessão ausente.");
    process.exit(1);
  }

  console.log("Baixando /admin/infra/data-snapshot ...");
  const snapRes = await fetch(`${base}/admin/infra/data-snapshot`, {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  const snapText = await snapRes.text();
  if (!snapRes.ok) {
    console.error("Snapshot falhou:", snapRes.status, snapText.slice(0, 500));
    console.error(
      "Se 404: faça Redeploy do waba_disparador com marker DEPLOY-*-data-snapshot-v02 e rode de novo.",
    );
    process.exit(1);
  }
  const snap = JSON.parse(snapText);
  if (!Array.isArray(snap.files) || !snap.files.length) {
    console.error("Snapshot sem arquivos.");
    process.exit(1);
  }

  const backupDir = path.join(
    V02_DIR,
    "_backups",
    `pre-pull-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  fs.mkdirSync(V02_DIR, { recursive: true });
  if (fs.existsSync(V02_DIR)) {
    fs.mkdirSync(backupDir, { recursive: true });
    for (const name of fs.readdirSync(V02_DIR)) {
      if (name === "_backups" || name === "vps-infra") continue;
      const src = path.join(V02_DIR, name);
      const st = fs.statSync(src);
      if (!st.isFile()) continue;
      fs.copyFileSync(src, path.join(backupDir, name));
    }
    console.log(`Backup local: ${backupDir}`);
  }

  let written = 0;
  for (const row of snap.files) {
    const file = String(row.file || "").trim();
    if (!file || file.includes("..") || file.includes("/") || file.includes("\\")) continue;
    writeJsonAtomic(path.join(V02_DIR, file), row.content);
    written += 1;
    console.log(`  OK ${file} (${row.sizeBytes || 0} bytes)`);
  }

  // Evita motor local competir com produção no mesmo EVO.
  writeJsonAtomic(path.join(V02_DIR, "aquecedor-desired-owners.json"), {
    version: 1,
    savedAt: new Date().toISOString(),
    desired: {},
    note: "Zerado no pull produção→V02 local para não duplicar envios no EVO.",
  });

  console.log(`\nConcluído: ${written} arquivo(s) em ${V02_DIR}`);
  console.log(`Gerado em produção: ${snap.generatedAt || "?"}`);
  if (Array.isArray(snap.skipped) && snap.skipped.length) {
    console.log("Pulados:", snap.skipped.map((s) => `${s.file} (${s.reason})`).join("; "));
  }
  console.log(
    "Lembrete: ENABLE_AQUECEDOR_PROCESSING=false e ENABLE_BACKGROUND_PROCESSING=false no .env.v02.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
