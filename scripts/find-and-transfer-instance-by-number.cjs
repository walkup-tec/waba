/**
 * Localiza instância Evolution pelo número WhatsApp e transfere o dono em instance-owners.json.
 *
 * Uso:
 *   node scripts/find-and-transfer-instance-by-number.cjs 51982006019 walkup@walkuptec.com.br
 *   node scripts/find-and-transfer-instance-by-number.cjs 51982006019 walkup@walkuptec.com.br --data-dir E:\Waba\data
 *   node scripts/find-and-transfer-instance-by-number.cjs 51982006019 walkup@walkuptec.com.br --dry-run
 *
 * Env: EVO_API_URL, EVO_API_KEY (ou .env / .env.v02)
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const https = require("node:https");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config({ path: path.join(ROOT, ".env.v02"), override: false });

const phoneArg = String(process.argv[2] || "").replace(/\D/g, "");
const targetEmail = String(process.argv[3] || "")
  .trim()
  .toLowerCase();
const dryRun = process.argv.includes("--dry-run");
const dataDirArg = (() => {
  const idx = process.argv.indexOf("--data-dir");
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || "").trim();
})();

if (!phoneArg || phoneArg.length < 10 || !targetEmail.includes("@")) {
  console.error(
    "Uso: node scripts/find-and-transfer-instance-by-number.cjs <numero> <email-destino> [--data-dir DIR] [--dry-run]",
  );
  process.exit(1);
}

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "").trim();
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() ||
  `${EVO_API_BASE}/instance/fetchInstances`;

const DATA_DIR = dataDirArg
  ? path.resolve(dataDirArg)
  : process.env.WABA_ENV === "v02"
    ? path.join(ROOT, "data", "v02")
    : path.join(ROOT, "data");

const OWNERS_PATH = path.join(DATA_DIR, "instance-owners.json");

function buildPhoneVariants(rawDigits) {
  const digits = String(rawDigits || "").replace(/\D/g, "");
  const out = new Set();
  if (!digits) return out;
  out.add(digits);
  if (digits.startsWith("55")) out.add(digits.slice(2));
  if (digits.length > 9) out.add(digits.slice(-9));
  if (digits.length > 8) out.add(digits.slice(-8));
  if (!digits.startsWith("55") && digits.length >= 10) out.add(`55${digits}`);
  return out;
}

const TARGET_VARIANTS = buildPhoneVariants(phoneArg);

function extractInstanceNumber(inst) {
  const raw =
    inst?.ownerJid ??
    inst?.owner ??
    inst?.number ??
    inst?.phone ??
    inst?.ownerNumber ??
    inst?.profile?.owner ??
    "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[0].replace(/\D/g, "");
  return s.replace(/\D/g, "");
}

function resolveInstanceKey(inst) {
  const candidate =
    inst?.instanceName ?? inst?.name ?? inst?.id ?? inst?.instanceId ?? inst?.instance ?? "";
  return String(candidate).trim();
}

function parseInstancesList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.response)) return raw.response;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.instances)) return raw.instances;
  }
  return raw ? [raw] : [];
}

function phonesLooselyMatch(queryDigits, instanceDigits) {
  const query = buildPhoneVariants(queryDigits);
  const instance = buildPhoneVariants(instanceDigits);
  for (const value of query) {
    if (instance.has(value)) return true;
  }
  const querySuffixes = [...query].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  const instanceSuffixes = [...instance].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  return querySuffixes.some((suffix) => instanceSuffixes.includes(suffix));
}

function phoneMatchesInstance(inst) {
  const num = extractInstanceNumber(inst);
  if (!num) return false;
  return phonesLooselyMatch(phoneArg, num);
}

function evoRequest(url, method = "GET") {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, status: 0, error: error.message, json: null, body: "" });
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const insecure =
      String(process.env.EVO_TLS_INSECURE || "").trim() === "1" ||
      /\.easypanel\.host$/i.test(parsed.hostname);
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
        ...(parsed.protocol === "https:" && insecure ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = null;
          }
          resolve({
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            status: res.statusCode || 0,
            body,
            json,
          });
        });
      },
    );
    req.on("error", (error) => {
      resolve({ ok: false, status: 0, error: error.message, json: null, body: "" });
    });
    req.end();
  });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

async function fetchProdInstanceOwnersViaLogin() {
  const prodBase = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
    /\/+$/,
    "",
  );
  const email = String(process.env.WABA_ADMIN_EMAIL || "walkup@walkuptec.com.br").trim();
  const password = String(process.env.WABA_ADMIN_PASSWORD || "").trim();
  if (!password) return null;

  const loginRes = await fetch(`${prodBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) return null;
  const cookie = (loginRes.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) return null;

  const snapRes = await fetch(`${prodBase}/admin/dashboard/persistence`, {
    headers: { Cookie: cookie },
  });
  if (!snapRes.ok) return null;
  return { cookie, prodBase };
}

async function main() {
  if (!EVO_API_BASE || !EVO_API_KEY) {
    console.error("EVO_API_URL / EVO_API_KEY não configurados.");
    process.exit(1);
  }

  const evoRes = await evoRequest(EVO_INSTANCES_URL, "GET");
  if (!evoRes.ok) {
    console.error("Falha ao listar instâncias Evolution:", evoRes.status, evoRes.body || evoRes.error);
    process.exit(1);
  }

  const instances = parseInstancesList(evoRes.json);
  const matches = instances.filter(phoneMatchesInstance);

  if (!matches.length) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "Nenhuma instância Evolution com esse número.",
          phone: phoneArg,
          scanned: instances.length,
          sampleNumbers: instances
            .slice(0, 15)
            .map((inst) => ({ name: resolveInstanceKey(inst), number: extractInstanceNumber(inst) })),
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const ownersStore = readJson(OWNERS_PATH, { instances: {} });
  if (!ownersStore.instances || typeof ownersStore.instances !== "object") {
    ownersStore.instances = {};
  }

  const transfers = [];
  for (const inst of matches) {
    const instanceName = resolveInstanceKey(inst);
    if (!instanceName) continue;
    const number = extractInstanceNumber(inst);
    const keyLower = instanceName.toLowerCase();
    let existingKey = null;
    for (const k of Object.keys(ownersStore.instances)) {
      if (k.toLowerCase() === keyLower) {
        existingKey = k;
        break;
      }
    }
    const previousOwner = existingKey
      ? String(ownersStore.instances[existingKey]?.ownerEmail || "").trim().toLowerCase()
      : null;

    transfers.push({
      instanceName,
      number,
      previousOwner: previousOwner || "(sem dono registrado)",
      newOwner: targetEmail,
    });

    if (!dryRun) {
      const record = {
        ownerEmail: targetEmail,
        createdAt:
          (existingKey && ownersStore.instances[existingKey]?.createdAt) ||
          new Date().toISOString(),
        transferredAt: new Date().toISOString(),
        transferredFrom: previousOwner || null,
        transferredByScript: "find-and-transfer-instance-by-number.cjs",
      };
      if (existingKey) ownersStore.instances[existingKey] = record;
      else ownersStore.instances[instanceName] = record;
    }
  }

  if (!dryRun && transfers.length) {
    writeJsonAtomic(OWNERS_PATH, ownersStore);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        dataDir: DATA_DIR,
        ownersPath: OWNERS_PATH,
        phone: phoneArg,
        transfers,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
