/**
 * Concede envios de crédito em produção.
 *
 * Remoto (API master — requer deploy com promote billing-only):
 *   node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 100
 *
 * Direto no volume (Easypanel shell /app):
 *   node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 100 --apply-data-dir /app/data
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env"), override: false });

const emailArg = String(process.argv[2] || "").trim().toLowerCase();
const countArg = Math.max(1, Math.round(Number(process.argv[3] || 0)));
const args = process.argv.slice(4);
const apiFlagIdx = args.indexOf("--api");
const applyDirFlagIdx = args.indexOf("--apply-data-dir");
const apiMode = apiFlagIdx >= 0 ? String(args[apiFlagIdx + 1] || "oficial").trim().toLowerCase() : "oficial";
const applyDataDir =
  applyDirFlagIdx >= 0 ? String(args[applyDirFlagIdx + 1] || "/app/data").trim() : "";
const prodBase = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
  /\/+$/,
  "",
);

if (!emailArg.includes("@") || !Number.isFinite(countArg) || countArg <= 0) {
  console.error(
    "Uso: node scripts/grant-disparos-credits-production.cjs email@dominio.com [envios] [--api oficial|alternativa|both] [--apply-data-dir /app/data]",
  );
  process.exit(1);
}

const loginEmail = String(process.env.WABA_ADMIN_EMAIL || "").trim();
const loginPassword = String(process.env.WABA_ADMIN_PASSWORD || "").trim();

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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

const resolveApiKinds = (segment) => {
  if (apiMode === "both") {
    if (segment === "bets") return ["oficial"];
    return ["oficial", "alternativa"];
  }
  if (apiMode === "alternativa") return ["alternativa"];
  return ["oficial"];
};

const buildPaidOrder = (email, apiKind, shipmentCount, customerName, whatsapp, cpfCnpj) => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    product: "waba-disparos",
    apiKind,
    customerName: String(customerName || "Assinante").trim() || "Assinante",
    ownerEmail: email,
    whatsapp: String(whatsapp || "").trim(),
    cpfCnpj: String(cpfCnpj || "").trim(),
    billingType: "PIX",
    valueCents: shipmentCount * 30,
    shipmentCount,
    status: "paid",
    asaasExternalReference: `waba:grant-credit:${id}`,
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    bonusShipmentsApplied: 0,
    bonusSettlementAt: now,
  };
};

function applyToDataDir(email, count, dataDir) {
  const subscribersPath = path.join(dataDir, "waba-subscribers.json");
  const store = readJson(subscribersPath, { version: 1, subscribers: [] });
  const subscriber = (store.subscribers || []).find((row) => normalizeEmail(row?.email) === email);
  if (!subscriber) throw new Error(`Assinante não encontrado em ${dataDir}: ${email}`);

  const apiKinds = resolveApiKinds(subscriber.segment);
  const billingOrders = apiKinds.map((apiKind) =>
    buildPaidOrder(
      email,
      apiKind,
      count,
      subscriber.fullName,
      subscriber.whatsapp || subscriber.phone,
      subscriber.cpfCnpj,
    ),
  );

  const ordersPath = path.join(dataDir, "waba-billing-orders.json");
  const orders = readJson(ordersPath, []);
  const orderList = Array.isArray(orders) ? orders : [];
  const knownIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
  let added = 0;
  for (const order of billingOrders) {
    if (knownIds.has(order.id)) continue;
    orderList.unshift(order);
    knownIds.add(order.id);
    added += 1;
  }
  writeJsonAtomic(ordersPath, orderList);

  return { billingOrdersAdded: added, billingOrders, segment: subscriber.segment || "outros" };
}

async function login() {
  if (!loginEmail || !loginPassword) {
    throw new Error("Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD em .env.v02 ou .env");
  }
  const res = await fetch(`${prodBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login master falhou (${res.status}): ${text.slice(0, 200)}`);
  }
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Cookie de sessão não recebido.");
  return cookie;
}

async function fetchSubscriberProfile(cookie, email) {
  const res = await fetch(`${prodBase}/admin/subscribers`, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error(`Listagem de assinantes falhou (${res.status})`);
  const data = await res.json();
  const rows = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.subscribers)
      ? data.subscribers
      : [];
  const hit = rows.find((row) => normalizeEmail(row?.email) === email);
  if (!hit) throw new Error(`Assinante não encontrado em produção: ${email}`);
  return hit;
}

async function grantCreditsRemote(cookie, email, subscriberProfile) {
  const apiKinds = resolveApiKinds(subscriberProfile?.segment);
  const billingOrders = apiKinds.map((apiKind) =>
    buildPaidOrder(email, apiKind, countArg, subscriberProfile?.fullName),
  );

  const bundle = {
    email,
    subscriber: { email },
    billingOrders,
  };

  const res = await fetch(`${prodBase}/admin/subscribers/promote-from-v02`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
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
    throw new Error(`Grant falhou (${res.status}): ${payload?.error || text.slice(0, 300)}`);
  }
  return { payload, billingOrders };
}

async function verifyCreditsRemote(cookie, email) {
  const res = await fetch(`${prodBase}/admin/subscribers`, { headers: { Cookie: cookie } });
  const data = await res.json();
  const rows = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.subscribers)
      ? data.subscribers
      : [];
  return rows.find((row) => normalizeEmail(row?.email) === email) || null;
}

async function main() {
  if (applyDataDir) {
    const result = applyToDataDir(emailArg, countArg, applyDataDir);
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "apply-data-dir",
          dataDir: applyDataDir,
          email: emailArg,
          enviosPorApi: countArg,
          segment: result.segment,
          apiKinds: result.billingOrders.map((order) => order.apiKind),
          orders: result.billingOrders.map((order) => ({
            id: order.id,
            apiKind: order.apiKind,
            shipmentCount: order.shipmentCount,
          })),
          billingOrdersAdded: result.billingOrdersAdded,
        },
        null,
        2,
      ),
    );
    if (result.billingOrdersAdded <= 0) process.exit(1);
    return;
  }

  const cookie = await login();
  const profile = await fetchSubscriberProfile(cookie, emailArg);
  const { payload, billingOrders } = await grantCreditsRemote(cookie, emailArg, profile);
  const after = await verifyCreditsRemote(cookie, emailArg);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "remote",
        email: emailArg,
        enviosPorApi: countArg,
        apiKinds: billingOrders.map((order) => order.apiKind),
        orders: billingOrders.map((order) => ({
          id: order.id,
          apiKind: order.apiKind,
          shipmentCount: order.shipmentCount,
        })),
        promote: payload,
        saldo: {
          contractedShipments: after?.contractedShipments ?? null,
          creditsValueLabel: after?.creditsValueLabel ?? null,
        },
      },
      null,
      2,
    ),
  );

  if (!(payload?.billingOrdersAdded > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
