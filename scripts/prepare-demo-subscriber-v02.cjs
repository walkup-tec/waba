/**
 * Prepara um assinante para demo/apresentação: conta zerada, cadastro recente.
 *
 * Uso:
 *   node scripts/prepare-demo-subscriber-v02.cjs assinante.teste@walkup.com [senha]
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const emailArg = String(process.argv[2] || "").trim().toLowerCase();
const passwordArg = String(process.argv[3] || "Walkup@2026").trim();

if (!emailArg.includes("@")) {
  console.error("Informe o e-mail: node scripts/prepare-demo-subscriber-v02.cjs email@dominio.com [senha]");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "..", "data", "v02");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "waba-subscribers.json");

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

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

const filterByEmail = (items, email, key = "ownerEmail") =>
  (items || []).filter((item) => String(item?.[key] || "").trim().toLowerCase() !== email);

const removeDirRecursive = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRecursive(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
};

const now = new Date().toISOString();
const store = readJson(SUBSCRIBERS_FILE, { version: 1, subscribers: [] });
const idx = store.subscribers.findIndex((s) => String(s.email || "").trim().toLowerCase() === emailArg);

if (idx < 0) {
  console.error(`Assinante não encontrado: ${emailArg}`);
  process.exit(1);
}

const current = store.subscribers[idx];
store.subscribers[idx] = {
  ...current,
  passwordHash: hashPassword(passwordArg),
  phone: String(current.phone || current.whatsapp || "").trim(),
  createdAt: now,
  updatedAt: now,
};
writeJsonAtomic(SUBSCRIBERS_FILE, store);

const billingPath = path.join(DATA_DIR, "waba-billing-orders.json");
const billing = readJson(billingPath, []);
if (Array.isArray(billing)) {
  const next = filterByEmail(billing, emailArg);
  if (next.length !== billing.length) writeJsonAtomic(billingPath, next);
}

const usagePath = path.join(DATA_DIR, "waba-disparos-credit-usage.json");
const usage = readJson(usagePath, { version: 2, entries: [] });
if (Array.isArray(usage.entries)) {
  usage.entries = usage.entries.filter((e) => String(e.email || "").trim().toLowerCase() !== emailArg);
  writeJsonAtomic(usagePath, usage);
}

const bonusPath = path.join(DATA_DIR, "waba-disparos-bonus-balances.json");
const bonus = readJson(bonusPath, { version: 2, entries: [] });
if (Array.isArray(bonus.entries)) {
  bonus.entries = bonus.entries.filter((e) => String(e.email || "").trim().toLowerCase() !== emailArg);
  writeJsonAtomic(bonusPath, bonus);
}

const intakesPath = path.join(DATA_DIR, "waba-campaign-intakes.json");
const intakesStore = readJson(intakesPath, { version: 1, intakes: [] });
const removedIntakeIds = [];
if (Array.isArray(intakesStore.intakes)) {
  const kept = [];
  for (const intake of intakesStore.intakes) {
    if (String(intake.ownerEmail || "").trim().toLowerCase() === emailArg) {
      removedIntakeIds.push(intake.id);
      continue;
    }
    kept.push(intake);
  }
  intakesStore.intakes = kept;
  writeJsonAtomic(intakesPath, intakesStore);
}

const intakesDir = path.join(DATA_DIR, "campaign-intakes");
for (const intakeId of removedIntakeIds) {
  removeDirRecursive(path.join(intakesDir, intakeId));
}

const ticketsPath = path.join(DATA_DIR, "waba-support-tickets.json");
const ticketsStore = readJson(ticketsPath, { version: 1, tickets: [] });
if (Array.isArray(ticketsStore.tickets)) {
  ticketsStore.tickets = ticketsStore.tickets.filter(
    (ticket) => String(ticket.ownerEmail || "").trim().toLowerCase() !== emailArg,
  );
  writeJsonAtomic(ticketsPath, ticketsStore);
}

const ownersPath = path.join(DATA_DIR, "instance-owners.json");
const ownersStore = readJson(ownersPath, { instances: {} });
if (ownersStore.instances && typeof ownersStore.instances === "object") {
  for (const [name, meta] of Object.entries(ownersStore.instances)) {
    if (String(meta?.ownerEmail || "").trim().toLowerCase() === emailArg) {
      delete ownersStore.instances[name];
    }
  }
  writeJsonAtomic(ownersPath, ownersStore);
}

console.log(JSON.stringify({
  ok: true,
  email: emailArg,
  password: passwordArg,
  createdAt: now,
  removedIntakeIds,
  message: "Assinante pronto para demo (sem compras, campanhas, instâncias ou chamados).",
}, null, 2));
