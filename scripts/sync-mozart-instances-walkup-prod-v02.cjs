/**
 * V02 testes: instâncias visíveis do mozart.pmo@gmail.com = lista do walkup em produção.
 *
 * Uso:
 *   node scripts/sync-mozart-instances-walkup-prod-v02.cjs
 *   WABA_ENV=v02 node scripts/sync-mozart-instances-walkup-prod-v02.cjs
 *
 * Requer .env.v02 com WABA_ADMIN_EMAIL / WABA_ADMIN_PASSWORD (login produção).
 * Fallback: data/v02/instance-owners-walkup-prod.snapshot.json ou instâncias walkup locais.
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const MOZART_EMAIL = "mozart.pmo@gmail.com";
const WALKUP_EMAIL = "walkup@walkuptec.com.br";
const PROD_BASE = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
  /\/+$/,
  "",
);
const DATA_DIR = path.join(__dirname, "..", "data", "v02");
const OWNERS_PATH = path.join(DATA_DIR, "instance-owners.json");
const SNAPSHOT_PATH = path.join(DATA_DIR, "instance-owners-walkup-prod.snapshot.json");

dotenv.config({ path: path.join(__dirname, "..", ".env.v02") });

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
};

async function fetchWalkupProdInstanceNames() {
  const email = String(process.env.WABA_ADMIN_EMAIL || WALKUP_EMAIL).trim();
  const password = String(process.env.WABA_ADMIN_PASSWORD || "").trim();
  if (!password) return null;

  const loginRes = await fetch(`${PROD_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) return null;
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) return null;

  const instRes = await fetch(`${PROD_BASE}/instancias?refresh=1`, {
    headers: { Cookie: cookie },
  });
  if (!instRes.ok) return null;
  const payload = await instRes.json();
  const names = (Array.isArray(payload?.items) ? payload.items : [])
    .map((row) => String(row?.name || row?.instanceName || "").trim())
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function loadFallbackNames() {
  const snap = readJson(SNAPSHOT_PATH, null);
  if (Array.isArray(snap?.instanceNames) && snap.instanceNames.length) {
    return snap.instanceNames;
  }
  const owners = readJson(OWNERS_PATH, { instances: {} });
  const names = [];
  for (const [name, meta] of Object.entries(owners.instances || {})) {
    if (String(meta?.ownerEmail || "").trim().toLowerCase() === WALKUP_EMAIL) {
      names.push(name);
    }
  }
  return names.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function main() {
  let names = await fetchWalkupProdInstanceNames();
  let source = "production";
  if (!names?.length) {
    names = loadFallbackNames();
    source = "snapshot/local-fallback";
  }
  if (!names.length) {
    console.error("Nenhuma instância walkup encontrada (produção ou fallback).");
    process.exit(1);
  }

  writeJsonAtomic(SNAPSHOT_PATH, {
    updatedAt: new Date().toISOString(),
    source: source === "production" ? PROD_BASE : source,
    ownerEmail: WALKUP_EMAIL,
    instanceNames: names,
  });

  const store = readJson(OWNERS_PATH, { instances: {} });
  if (!store.instances || typeof store.instances !== "object") store.instances = {};
  const mozart = MOZART_EMAIL.toLowerCase();

  for (const [name, meta] of Object.entries({ ...store.instances })) {
    if (String(meta?.ownerEmail || "").trim().toLowerCase() === mozart && !names.includes(name)) {
      delete store.instances[name];
    }
  }

  const now = new Date().toISOString();
  for (const name of names) {
    const existing = store.instances[name];
    store.instances[name] = {
      ownerEmail: MOZART_EMAIL,
      createdAt: existing?.createdAt || now,
      syncedFromWalkupProdAt: now,
    };
  }

  writeJsonAtomic(OWNERS_PATH, store);

  console.log(
    JSON.stringify(
      {
        ok: true,
        source,
        mozartEmail: MOZART_EMAIL,
        instanceCount: names.length,
        instances: names,
        ownersFile: OWNERS_PATH,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
