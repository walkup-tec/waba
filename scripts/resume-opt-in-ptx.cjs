#!/usr/bin/env node
/** Força resume do lote paulo_teix_v2_2 (18c8340d) no JSON do Disparo Cloud. */
const fs = require("fs");
const path = require("path");

const BROADCAST_ID = "18c8340d-da12-47f1-8577-67f8a762aa32";
const INTAKE_IDS = new Set([
  "c213963a-209a-465e-b3b6-85fef1328caf",
  "66c63991-9c2f-42a2-b024-7aeab1b71546",
]);
const filePath = String(process.argv[2] || "/app/data/meta-whatsapp-broadcasts.json");

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

function errorHist(leads) {
  const out = {};
  for (const lead of leads || []) {
    if (String(lead.status || "") !== "failed") continue;
    const key = String(lead.errorCode || lead.error || "(sem codigo)").slice(0, 80);
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

function isTarget(row) {
  if (String(row.id || "") === BROADCAST_ID) return true;
  return INTAKE_IDS.has(String(row.intakeCampaignId || ""));
}

console.log("campaigns_total", campaigns.length);
for (const r of campaigns) {
  console.log(
    JSON.stringify({
      id: r.id,
      intake: r.intakeCampaignId || null,
      status: r.status,
      sent: r.sent,
      failed: r.failed,
      total: r.total,
      template: r.templateName,
      hist: hist(r.leads),
      target: isTarget(r),
    }),
  );
}

const row = campaigns.find(isTarget);
if (!row) {
  console.error("CAMPANHA NAO ENCONTRADA");
  process.exit(3);
}

console.log("ANTES_ERROS", JSON.stringify(errorHist(row.leads)));
console.log(
  "ANTES_WAMID",
  JSON.stringify({
    withWamid: (row.leads || []).filter(hasWamid).length,
    withoutWamid: (row.leads || []).filter((lead) => !hasWamid(lead)).length,
  }),
);

let queuedReset = 0;
for (const lead of row.leads || []) {
  const status = String(lead.status || "").trim();
  if (status === "sent" || status === "skipped") continue;
  if (hasWamid(lead)) continue;
  if (status === "failed" || !status) {
    lead.status = "queued";
    delete lead.metaStatus;
    delete lead.error;
    delete lead.errorCode;
    queuedReset += 1;
  }
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
