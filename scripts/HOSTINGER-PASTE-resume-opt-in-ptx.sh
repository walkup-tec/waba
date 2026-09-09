#!/bin/bash
# COLE NO HOSTINGER (root) — força resume da Opt in PTX de onde parou.
# NÃO faz Redeploy / docker service update. O watchdog (~20s) retoma o loop.
# Intake: 66c63991-9c2f-42a2-b024-7aeab1b71546  |  1980 / 2996
set -euo pipefail

INTAKE="66c63991-9c2f-42a2-b024-7aeab1b71546"
FILE="/app/data/meta-whatsapp-broadcasts.json"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1 || true)"
if [ -z "${CONTAINER}" ]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba_waba_disparador' | head -1 || true)"
fi
echo "CONTAINER=${CONTAINER}"
test -n "${CONTAINER}"

docker exec -w /app "${CONTAINER}" node - "${INTAKE}" "${FILE}" <<'NODE'
const fs = require("fs");
const path = require("path");
const intakeId = String(process.argv[2] || "").trim();
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
  const status = String(lead && lead.status || "").trim();
  return !status || status === "queued";
}

function hasWamid(lead) {
  return Boolean(String(lead && lead.wamid || "").trim());
}

const byIntake = campaigns.filter((row) => String(row.intakeCampaignId || "") === intakeId);
const byProgress = campaigns.filter((row) => {
  const sent = Number(row.sent || 0);
  const total = Number(row.total || 0);
  return sent >= 1900 && sent <= 2050 && total >= 2900 && total <= 3100;
});

console.log("campaigns_total", campaigns.length);
console.log("match_intake", byIntake.length, byIntake.map((row) => ({
  id: row.id,
  status: row.status,
  voidedAt: row.voidedAt || null,
  sent: row.sent,
  failed: row.failed,
  total: row.total,
  pending: (row.leads || []).filter(pendingLead).length,
  hist: hist(row.leads),
})));
console.log("match_1980_2996", byProgress.length, byProgress.map((row) => ({
  id: row.id,
  intakeCampaignId: row.intakeCampaignId || null,
  status: row.status,
  voidedAt: row.voidedAt || null,
  sent: row.sent,
  failed: row.failed,
  total: row.total,
  pending: (row.leads || []).filter(pendingLead).length,
  hist: hist(row.leads),
})));

const row = byIntake[0] || byProgress[0];
if (!row) {
  console.error("CAMPANHA NAO ENCONTRADA");
  process.exit(3);
}

let queuedReset = 0;
for (const lead of row.leads || []) {
  const status = String(lead.status || "").trim();
  if (status === "sent" || status === "skipped") continue;
  if (hasWamid(lead) && status === "sent") continue;
  if (hasWamid(lead)) continue;
  if (status === "failed") {
    lead.status = "queued";
    lead.metaStatus = "queued";
    delete lead.error;
    delete lead.errorCode;
    queuedReset += 1;
    continue;
  }
  if (!status || status === "queued") {
    lead.status = "queued";
  }
}

row.status = "running";
row.voidedAt = undefined;
row.sendFinishedAt = undefined;
row.updatedAt = now;
row.sent = (row.leads || []).filter((lead) => String(lead.status || "") === "sent").length;
row.failed = (row.leads || []).filter((lead) => String(lead.status || "") === "failed").length;
delete row.voidedAt;
delete row.sendFinishedAt;

const tmp = `${filePath}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({ version: 1, campaigns }, null, 2));
fs.copyFileSync(tmp, filePath);
try { fs.unlinkSync(tmp); } catch {}

const pending = (row.leads || []).filter(pendingLead).length;
console.log("APLICADO", {
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
});
if (pending < 1) {
  console.error("SEM FILA PENDENTE — nada para retomar");
  process.exit(4);
}
NODE

echo "--- aguarde o watchdog (~25s) ---"
sleep 25
echo -n "health marker: "
curl -sS --max-time 12 http://127.0.0.1:30180/health | python3 -c 'import json,sys
h=json.load(sys.stdin)
print(h.get("deployMarker"))
print("protect", json.dumps(h.get("cloudBroadcastProtect"), ensure_ascii=False))'
echo
echo "OK se protect.active=true e pendingLeads>0. Na UI: Enviando, andamento > 1980/2996."
echo "NÃO faça Redeploy enquanto estiver Enviando."
