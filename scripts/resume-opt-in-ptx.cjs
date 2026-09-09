#!/usr/bin/env node
/** Força resume da Opt in PTX no JSON do Disparo Cloud. Rodar DENTRO do container. */
const fs = require("fs");
const path = require("path");

const intakeId = String(process.argv[2] || "66c63991-9c2f-42a2-b024-7aeab1b71546").trim();
const filePath = String(process.argv[3] || "/app/data/meta-whatsapp-broadcasts.json");

if (!fs.existsSync(filePath)) {
  console.error("ARQUIVO AUSENTE", filePath);
  process.exit(2);
}

const raw = fs.readFileSync(filePath, "utf8");
const store = JSON.parse(raw);
const campaigns = Array.isArray(store.campaigns) ? store.campaigns : [];
const now = new Date().toISOString();
const stamp = now.replace(/[:.]/g, "-");
const backup = path.join(path.dirname(filePath), `_backups/opt-in-ptx-resume-${stamp}.json`);
fs.mkdirSync(path.dirname(backup), { recursive: true });
fs.writeFileSync(backup, raw);

function hist(leads) {
  const out = {};
  for (const lead of leads || []) {
    const key = String(lead.status || "(vazio)") || "(vazio)";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function pendingLead(lead) {
  const status = String((lead && lead.status) || "").trim();
  return !status || status === "queued";
}

function hasWamid(lead) {
  return Boolean(String((lead && lead.wamid) || "").trim());
}

const byIntake = campaigns.filter((row) => String(row.intakeCampaignId || "") === intakeId);
const byProgress = campaigns.filter((row) => {
  const sent = Number(row.sent || 0);
  const total = Number(row.total || 0);
  return sent >= 1900 && sent <= 2050 && total >= 2900 && total <= 3100;
});

console.log("campaigns_total", campaigns.length);
console.log(
  "match_intake",
  byIntake.length,
  JSON.stringify(
    byIntake.map((row) => ({
      id: row.id,
      status: row.status,
      voidedAt: row.voidedAt || null,
      sent: row.sent,
      failed: row.failed,
      total: row.total,
      pending: (row.leads || []).filter(pendingLead).length,
      hist: hist(row.leads),
    })),
  ),
);
console.log(
  "match_1980_2996",
  byProgress.length,
  JSON.stringify(
    byProgress.map((row) => ({
      id: row.id,
      intakeCampaignId: row.intakeCampaignId || null,
      status: row.status,
      voidedAt: row.voidedAt || null,
      sent: row.sent,
      failed: row.failed,
      total: row.total,
      pending: (row.leads || []).filter(pendingLead).length,
      hist: hist(row.leads),
    })),
  ),
);

const row = byIntake[0] || byProgress[0];
if (!row) {
  console.error("CAMPANHA NAO ENCONTRADA");
  process.exit(3);
}

let queuedReset = 0;
for (const lead of row.leads || []) {
  const status = String(lead.status || "").trim();
  if (status === "sent" || status === "skipped") continue;
  if (hasWamid(lead)) continue;
  if (status === "failed") {
    lead.status = "queued";
    lead.metaStatus = "queued";
    delete lead.error;
    delete lead.errorCode;
    queuedReset += 1;
    continue;
  }
  if (!status || status === "queued") lead.status = "queued";
}

row.status = "running";
row.updatedAt = now;
row.sent = (row.leads || []).filter((lead) => String(lead.status || "") === "sent").length;
row.failed = (row.leads || []).filter((lead) => String(lead.status || "") === "failed").length;
delete row.voidedAt;
delete row.sendFinishedAt;

const tmp = `${filePath}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({ version: 1, campaigns }, null, 2));
fs.copyFileSync(tmp, filePath);
try {
  fs.unlinkSync(tmp);
} catch {
  /* ignore */
}

const pending = (row.leads || []).filter(pendingLead).length;
console.log(
  "APLICADO",
  JSON.stringify({
    backup,
    id: row.id,
    intakeCampaignId: row.intakeCampaignId || null,
    status: row.status,
    sent: row.sent,
    failed: row.failed,
    total: row.total,
    pending,
    queuedReset,
    hist: hist(row.leads),
  }),
);
if (pending < 1) {
  console.error("SEM FILA PENDENTE — nada para retomar");
  process.exit(4);
}
