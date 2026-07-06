/**
 * Remove assinante e dados relacionados por e-mail.
 *
 * Local v02:
 *   node scripts/delete-subscriber-by-email.cjs digitalcorban@gmail.com --data-dir data/v02
 *
 * Produção (SSH + container):
 *   CID=$(docker ps -q -f name=waba_disparador | head -1)
 *   docker cp scripts/delete-subscriber-by-email.cjs $CID:/tmp/
 *   docker exec $CID node /tmp/delete-subscriber-by-email.cjs digitalcorban@gmail.com --data-dir /app/data
 */
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? String(args[idx + 1] || "").trim() : "";
};

const emailArg = args.find((arg) => !arg.startsWith("--") && arg.includes("@"));
const dataDir = readArg("--data-dir") || path.join(__dirname, "..", "data");
const dryRun = args.includes("--dry-run");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, data) => {
  if (dryRun) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
};

const removeDirRecursive = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRecursive(full);
    else fs.unlinkSync(full);
  }
  if (!dryRun) fs.rmdirSync(dir);
};

function main() {
  const email = normalizeEmail(emailArg);
  if (!email || !email.includes("@")) {
    console.error("Uso: node scripts/delete-subscriber-by-email.cjs email@dominio.com [--data-dir path] [--dry-run]");
    process.exit(1);
  }

  const summary = {
    email,
    dataDir,
    dryRun,
    subscriberRemoved: false,
    systemUserRemoved: false,
    billingOrdersRemoved: 0,
    creditUsageRemoved: false,
    bonusBalanceRemoved: false,
    campaignIntakesRemoved: 0,
    campaignIntakeDirsRemoved: 0,
    alternativaActivationsRemoved: false,
    instanceOwnersRemoved: 0,
    supportTicketsRemoved: 0,
    splitSettlementsRemoved: 0,
  };

  const subscribersPath = path.join(dataDir, "waba-subscribers.json");
  const subscribersStore = readJson(subscribersPath, { version: 1, subscribers: [] });
  if (!Array.isArray(subscribersStore.subscribers)) subscribersStore.subscribers = [];
  const beforeSubs = subscribersStore.subscribers.length;
  subscribersStore.subscribers = subscribersStore.subscribers.filter(
    (row) => normalizeEmail(row?.email) !== email,
  );
  summary.subscriberRemoved = subscribersStore.subscribers.length < beforeSubs;
  if (summary.subscriberRemoved) writeJson(subscribersPath, subscribersStore);

  const systemUsersPath = path.join(dataDir, "waba-system-users.json");
  const systemUsersStore = readJson(systemUsersPath, { version: 1, users: [] });
  if (Array.isArray(systemUsersStore.users)) {
    const beforeUsers = systemUsersStore.users.length;
    systemUsersStore.users = systemUsersStore.users.filter((user) => {
      if (normalizeEmail(user?.email) !== email) return true;
      return String(user?.role ?? "").trim().toLowerCase() === "master";
    });
    summary.systemUserRemoved = systemUsersStore.users.length < beforeUsers;
    if (summary.systemUserRemoved) writeJson(systemUsersPath, systemUsersStore);
  }

  const ordersPath = path.join(dataDir, "waba-billing-orders.json");
  const orders = readJson(ordersPath, []);
  if (Array.isArray(orders)) {
    const kept = orders.filter((order) => normalizeEmail(order?.ownerEmail) !== email);
    summary.billingOrdersRemoved = orders.length - kept.length;
    if (summary.billingOrdersRemoved > 0) writeJson(ordersPath, kept);
  }

  const creditPath = path.join(dataDir, "waba-disparos-credit-usage.json");
  const creditStore = readJson(creditPath, { version: 2, entries: [] });
  if (Array.isArray(creditStore.entries)) {
    const kept = creditStore.entries.filter((entry) => normalizeEmail(entry?.email) !== email);
    summary.creditUsageRemoved = kept.length < creditStore.entries.length;
    if (summary.creditUsageRemoved) writeJson(creditPath, { ...creditStore, entries: kept });
  }

  const bonusPath = path.join(dataDir, "waba-disparos-bonus-balances.json");
  const bonusStore = readJson(bonusPath, { version: 2, entries: [] });
  if (Array.isArray(bonusStore.entries)) {
    const kept = bonusStore.entries.filter((entry) => normalizeEmail(entry?.email) !== email);
    summary.bonusBalanceRemoved = kept.length < bonusStore.entries.length;
    if (summary.bonusBalanceRemoved) writeJson(bonusPath, { ...bonusStore, entries: kept });
  }

  const intakesPath = path.join(dataDir, "waba-campaign-intakes.json");
  const intakesStore = readJson(intakesPath, { version: 1, intakes: [] });
  if (!Array.isArray(intakesStore.intakes)) intakesStore.intakes = [];
  const removedIntakeIds = [];
  const keptIntakes = intakesStore.intakes.filter((intake) => {
    if (normalizeEmail(intake?.ownerEmail) !== email) return true;
    if (intake?.id) removedIntakeIds.push(String(intake.id));
    return false;
  });
  summary.campaignIntakesRemoved = intakesStore.intakes.length - keptIntakes.length;
  if (summary.campaignIntakesRemoved > 0) {
    writeJson(intakesPath, { ...intakesStore, intakes: keptIntakes });
    const intakesDir = path.join(dataDir, "campaign-intakes");
    for (const intakeId of removedIntakeIds) {
      const dir = path.join(intakesDir, intakeId);
      if (fs.existsSync(dir)) {
        if (dryRun) summary.campaignIntakeDirsRemoved += 1;
        else {
          removeDirRecursive(dir);
          summary.campaignIntakeDirsRemoved += 1;
        }
      }
    }
  }

  const altPath = path.join(dataDir, "alternativa-number-activations.json");
  const altStore = readJson(altPath, { byEmail: {} });
  if (altStore?.byEmail && Object.prototype.hasOwnProperty.call(altStore.byEmail, email)) {
    delete altStore.byEmail[email];
    summary.alternativaActivationsRemoved = true;
    writeJson(altPath, altStore);
  }

  const ownersPath = path.join(dataDir, "instance-owners.json");
  const ownersStore = readJson(ownersPath, { instances: {}, deletedInstances: {} });
  if (ownersStore?.instances && typeof ownersStore.instances === "object") {
    for (const [key, value] of Object.entries(ownersStore.instances)) {
      if (normalizeEmail(value?.ownerEmail) === email) {
        delete ownersStore.instances[key];
        summary.instanceOwnersRemoved += 1;
      }
    }
    if (summary.instanceOwnersRemoved > 0) writeJson(ownersPath, ownersStore);
  }

  const ticketsPath = path.join(dataDir, "waba-support-tickets.json");
  const ticketsStore = readJson(ticketsPath, { version: 1, tickets: [] });
  if (Array.isArray(ticketsStore.tickets)) {
    const removedTickets = ticketsStore.tickets.filter(
      (ticket) => normalizeEmail(ticket?.ownerEmail) === email,
    );
    const keptTickets = ticketsStore.tickets.filter(
      (ticket) => normalizeEmail(ticket?.ownerEmail) !== email,
    );
    summary.supportTicketsRemoved = removedTickets.length;
    if (summary.supportTicketsRemoved > 0) {
      writeJson(ticketsPath, { ...ticketsStore, tickets: keptTickets });
      const supportDir = path.join(dataDir, "support-tickets");
      for (const ticket of removedTickets) {
        const dir = path.join(supportDir, String(ticket.id || ""));
        if (fs.existsSync(dir) && !dryRun) removeDirRecursive(dir);
      }
    }
  }

  const settlementsPath = path.join(dataDir, "waba-financeiro-split-settlements.json");
  const settlementsStore = readJson(settlementsPath, { version: 1, settlements: [] });
  if (Array.isArray(settlementsStore.settlements)) {
    const kept = settlementsStore.settlements.filter(
      (row) => normalizeEmail(row?.ownerEmail) !== email,
    );
    summary.splitSettlementsRemoved = settlementsStore.settlements.length - kept.length;
    if (summary.splitSettlementsRemoved > 0) {
      writeJson(settlementsPath, { ...settlementsStore, settlements: kept });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.subscriberRemoved) {
    console.error(`Assinante não encontrado em ${subscribersPath}`);
    process.exit(2);
  }
}

main();
