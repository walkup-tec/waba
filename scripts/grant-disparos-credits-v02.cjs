/**
 * Concede envios de teste (pedidos pagos fictícios) por API.
 *
 * Uso:
 *   node scripts/grant-disparos-credits-v02.cjs mozart.pmo@gmail.com 500
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const emailArg = String(process.argv[2] || "").trim().toLowerCase();
const countArg = Math.max(1, Math.round(Number(process.argv[3] || 500)));

if (!emailArg.includes("@")) {
  console.error("Uso: node scripts/grant-disparos-credits-v02.cjs email@dominio.com [enviosPorApi]");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "..", "data", "v02");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "waba-subscribers.json");
const ORDERS_FILE = path.join(DATA_DIR, "waba-billing-orders.json");

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = (filePath, data) => {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(filePath, fs.readFileSync(tmp));
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
};

const subscribers = readJson(SUBSCRIBERS_FILE, { version: 1, subscribers: [] });
const subscriber = (subscribers.subscribers || []).find(
  (item) => String(item.email || "").trim().toLowerCase() === emailArg,
);
if (!subscriber) {
  console.error(`Assinante não encontrado: ${emailArg}`);
  process.exit(1);
}

const now = new Date().toISOString();
const orders = readJson(ORDERS_FILE, []);
if (!Array.isArray(orders)) {
  console.error("Arquivo de pedidos inválido.");
  process.exit(1);
}

const buildTestOrder = (apiKind) => {
  const id = crypto.randomUUID();
  return {
    id,
    product: "waba-disparos",
    apiKind,
    customerName: String(subscriber.fullName || "Assinante").trim() || "Assinante",
    ownerEmail: emailArg,
    whatsapp: String(subscriber.whatsapp || subscriber.phone || "").trim(),
    cpfCnpj: String(subscriber.cpfCnpj || "").trim(),
    billingType: "PIX",
    valueCents: countArg * 30,
    shipmentCount: countArg,
    status: "paid",
    asaasExternalReference: `waba:test-credit:${id}`,
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    bonusShipmentsApplied: 0,
    bonusSettlementAt: now,
  };
};

const created = [buildTestOrder("oficial"), buildTestOrder("alternativa")];
orders.unshift(...created);
writeJsonAtomic(ORDERS_FILE, orders);

console.log(`Créditos de teste concedidos para ${emailArg}:`);
for (const order of created) {
  console.log(`  - ${order.apiKind}: +${order.shipmentCount} envios (pedido ${order.id})`);
}
