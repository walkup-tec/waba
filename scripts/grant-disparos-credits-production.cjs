/**
 * Concede envios de crédito em produção via POST /admin/subscribers/promote-from-v02
 * (modo billing-only — não altera senha/dados do assinante existente).
 *
 * Uso:
 *   node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 100
 *   node scripts/grant-disparos-credits-production.cjs email@dominio.com 100 --api oficial
 *   node scripts/grant-disparos-credits-production.cjs email@dominio.com 100 --api both
 */
const crypto = require("node:crypto");
const path = require("node:path");
const dotenv = require("dotenv");

const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env"), override: false });

const emailArg = String(process.argv[2] || "").trim().toLowerCase();
const countArg = Math.max(1, Math.round(Number(process.argv[3] || 0)));
const args = process.argv.slice(4);
const apiFlagIdx = args.indexOf("--api");
const apiMode = apiFlagIdx >= 0 ? String(args[apiFlagIdx + 1] || "oficial").trim().toLowerCase() : "oficial";
const prodBase = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
  /\/+$/,
  "",
);

if (!emailArg.includes("@") || !Number.isFinite(countArg) || countArg <= 0) {
  console.error(
    "Uso: node scripts/grant-disparos-credits-production.cjs email@dominio.com [envios] [--api oficial|alternativa|both]",
  );
  process.exit(1);
}

const loginEmail = String(process.env.WABA_ADMIN_EMAIL || "").trim();
const loginPassword = String(process.env.WABA_ADMIN_PASSWORD || "").trim();
if (!loginEmail || !loginPassword) {
  console.error("Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD em .env.v02 ou .env");
  process.exit(1);
}

const resolveApiKinds = () => {
  if (apiMode === "both") return ["oficial", "alternativa"];
  if (apiMode === "alternativa") return ["alternativa"];
  return ["oficial"];
};

const buildPaidOrder = (email, apiKind, shipmentCount, customerName) => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    product: "waba-disparos",
    apiKind,
    customerName: String(customerName || "Assinante").trim() || "Assinante",
    ownerEmail: email,
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

async function login() {
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
  const rows = Array.isArray(data?.subscribers) ? data.subscribers : [];
  const hit = rows.find((row) => String(row?.email || "").trim().toLowerCase() === email);
  if (!hit) throw new Error(`Assinante não encontrado em produção: ${email}`);
  return hit;
}

async function grantCredits(cookie, email, subscriberProfile) {
  const apiKinds = resolveApiKinds();
  if (subscriberProfile?.segment === "bets" && apiMode === "both") {
    console.warn("Aviso: segmento Bets — concedendo apenas API Oficial.");
    apiKinds.length = 0;
    apiKinds.push("oficial");
  }

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

async function verifyCredits(cookie, email) {
  const res = await fetch(`${prodBase}/admin/subscribers`, { headers: { Cookie: cookie } });
  const data = await res.json();
  const rows = Array.isArray(data?.subscribers) ? data.subscribers : [];
  return rows.find((row) => String(row?.email || "").trim().toLowerCase() === email) || null;
}

async function main() {
  const cookie = await login();
  const profile = await fetchSubscriberProfile(cookie, emailArg);
  const { payload, billingOrders } = await grantCredits(cookie, emailArg, profile);
  const after = await verifyCredits(cookie, emailArg);

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: emailArg,
        enviosPorApi: countArg,
        apiKinds: billingOrders.map((order) => order.apiKind),
        orders: billingOrders.map((order) => ({ id: order.id, apiKind: order.apiKind, shipmentCount: order.shipmentCount })),
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
