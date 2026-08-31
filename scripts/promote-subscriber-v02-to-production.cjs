/**
 * Promove assinante do V02 (data/v02) para produção.
 *
 * Uso local no servidor (Easypanel shell, pasta /app):
 *   node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --apply-data-dir /app/data
 *
 * Uso remoto (após deploy com POST /admin/subscribers/promote-from-v02):
 *   node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --remote https://waba.draxsistemas.com.br
 *
 * Só exportar bundle JSON:
 *   node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --print-bundle
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const emailArg = String(process.argv[2] || "").trim().toLowerCase();
const flags = new Set(process.argv.slice(3));
const applyDataDir = (() => {
  const idx = process.argv.indexOf("--apply-data-dir");
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || "").trim();
})();
const remoteBase = (() => {
  const idx = process.argv.indexOf("--remote");
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br")
    .trim()
    .replace(/\/+$/, "");
})();

if (!emailArg.includes("@")) {
  console.error(
    "Uso: node scripts/promote-subscriber-v02-to-production.cjs email@dominio.com [--apply-data-dir /app/data] [--remote URL] [--print-bundle]",
  );
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const V02_DIR = path.join(ROOT, "data", "v02");

dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env") });

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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

function buildBundle(email) {
  const subscribers = readJson(path.join(V02_DIR, "waba-subscribers.json"), { version: 1, subscribers: [] });
  const subscriber = (subscribers.subscribers || []).find(
    (row) => normalizeEmail(row?.email) === email,
  );
  if (!subscriber) {
    throw new Error(`Assinante não encontrado no V02: ${email}`);
  }

  const billingOrders = readJson(path.join(V02_DIR, "waba-billing-orders.json"), []).filter(
    (row) => normalizeEmail(row?.ownerEmail) === email,
  );

  const usageStore = readJson(path.join(V02_DIR, "waba-disparos-credit-usage.json"), {
    version: 2,
    entries: [],
  });
  const usageRow =
    (usageStore.entries || []).find((row) => normalizeEmail(row?.email) === email) || null;

  const ownersStore = readJson(path.join(V02_DIR, "instance-owners.json"), { instances: {} });
  const instanceOwners = {};
  for (const [name, meta] of Object.entries(ownersStore.instances || {})) {
    if (normalizeEmail(meta?.ownerEmail) !== email) continue;
    instanceOwners[name] = {
      ownerEmail: email,
      createdAt: meta?.createdAt,
      syncedFromWalkupProdAt: meta?.syncedFromWalkupProdAt,
    };
  }

  return {
    email,
    subscriber,
    billingOrders,
    creditUsage: usageRow
      ? {
          consumedOficial: usageRow.consumedOficial,
          consumedAlternativa: usageRow.consumedAlternativa,
          updatedAt: usageRow.updatedAt,
        }
      : undefined,
    instanceOwners,
  };
}

function applyBundleToDataDir(bundle, dataDir) {
  const email = bundle.email;
  const subscribersPath = path.join(dataDir, "waba-subscribers.json");
  const store = readJson(subscribersPath, { version: 1, subscribers: [] });
  if (!Array.isArray(store.subscribers)) store.subscribers = [];
  const idx = store.subscribers.findIndex((row) => normalizeEmail(row?.email) === email);
  const payload = {
    ...bundle.subscriber,
    email,
    phone: String(bundle.subscriber.phone || bundle.subscriber.whatsapp || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  let subscriberAction = "created";
  if (idx >= 0) {
    store.subscribers[idx] = { ...store.subscribers[idx], ...payload, id: store.subscribers[idx].id };
    subscriberAction = "updated";
  } else {
    store.subscribers.push(payload);
  }
  writeJsonAtomic(subscribersPath, store);

  const ordersPath = path.join(dataDir, "waba-billing-orders.json");
  const orders = readJson(ordersPath, []);
  const orderList = Array.isArray(orders) ? orders : [];
  const knownIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
  let billingOrdersAdded = 0;
  for (const order of bundle.billingOrders || []) {
    const id = String(order?.id || "").trim();
    if (!id || knownIds.has(id)) continue;
    orderList.unshift(order);
    knownIds.add(id);
    billingOrdersAdded += 1;
  }
  writeJsonAtomic(ordersPath, orderList);

  let creditUsage = false;
  if (bundle.creditUsage) {
    const usagePath = path.join(dataDir, "waba-disparos-credit-usage.json");
    const usageStore = readJson(usagePath, { version: 2, entries: [] });
    if (!Array.isArray(usageStore.entries)) usageStore.entries = [];
    const entry = {
      email,
      consumedOficial: Math.max(0, Math.round(Number(bundle.creditUsage.consumedOficial ?? 0))),
      consumedAlternativa: Math.max(0, Math.round(Number(bundle.creditUsage.consumedAlternativa ?? 0))),
      updatedAt: String(bundle.creditUsage.updatedAt || new Date().toISOString()),
    };
    const usageIdx = usageStore.entries.findIndex((row) => normalizeEmail(row?.email) === email);
    if (usageIdx >= 0) usageStore.entries[usageIdx] = entry;
    else usageStore.entries.push(entry);
    writeJsonAtomic(usagePath, usageStore);
    creditUsage = true;
  }

  const ownersPath = path.join(dataDir, "instance-owners.json");
  const ownersStore = readJson(ownersPath, { instances: {} });
  if (!ownersStore.instances || typeof ownersStore.instances !== "object") ownersStore.instances = {};
  const now = new Date().toISOString();
  let instanceOwners = 0;
  for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
    const key = String(name || "").trim();
    if (!key) continue;
    ownersStore.instances[key] = {
      ownerEmail: email,
      createdAt: String(meta?.createdAt || now),
      ...(meta?.syncedFromWalkupProdAt
        ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
        : { promotedFromV02At: now }),
    };
    instanceOwners += 1;
  }
  if (instanceOwners > 0) writeJsonAtomic(ownersPath, ownersStore);

  return {
    ok: true,
    email,
    dataDir,
    subscriber: subscriberAction,
    billingOrdersAdded,
    creditUsage,
    instanceOwners,
  };
}

async function loginMaster(baseUrl) {
  const email = String(process.env.WABA_ADMIN_EMAIL || "").trim();
  const password = String(process.env.WABA_ADMIN_PASSWORD || "").trim();
  if (!email || !password) {
    throw new Error("Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD em .env.v02 ou .env");
  }
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login master falhou (${loginRes.status}): ${text.slice(0, 200)}`);
  }
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("Login master sem cookie de sessão.");
  return cookie;
}

async function promoteRemote(bundle, baseUrl) {
  const cookie = await loginMaster(baseUrl);
  const res = await fetch(`${baseUrl}/admin/subscribers/promote-from-v02`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(bundle),
  });
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    throw new Error(`Promote remoto falhou (${res.status}): ${payload?.error || text.slice(0, 300)}`);
  }
  return payload;
}

async function main() {
  const bundle = buildBundle(emailArg);

  if (flags.has("--print-bundle")) {
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  if (applyDataDir) {
    const result = applyBundleToDataDir(bundle, applyDataDir);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (remoteBase) {
    const result = await promoteRemote(bundle, remoteBase);
    console.log(JSON.stringify({ ok: true, mode: "remote", baseUrl: remoteBase, result }, null, 2));
    return;
  }

  console.error(
    "Informe --apply-data-dir /app/data (no servidor) ou --remote https://waba.draxsistemas.com.br",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
