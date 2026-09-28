#!/bin/bash
# Recoloca a campanha Pelli na fila do Claudinei (Aguardando configuração),
# com indicadores zerados, para ele iniciar e informar os números reais.
# NÃO altera a regra de distribuição. NÃO Redeploy.
# Idempotente. Backup do JSON antes de gravar.
# Procura pelo UUID, depois pelo nome (Pelli / agenda pessoal).
set -euo pipefail

PELLI_ID="${CAMPAIGN_ID:-}"
NAME_QUERY="${CAMPAIGN_NAME:-pelli}"
CLAUDINEI_EMAIL="${CLAUDINEI_EMAIL:-negociosltda01@gmail.com}"
APPLY="${APPLY:-1}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v02|v01' | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "ERRO: container waba_disparador não encontrado"
  docker ps --format '{{.Names}}' | head -20
  exit 1
fi

echo "Container: $CONTAINER"
docker exec \
  -e PELLI_ID="$PELLI_ID" \
  -e NAME_QUERY="$NAME_QUERY" \
  -e CLAUDINEI_EMAIL="$CLAUDINEI_EMAIL" \
  -e APPLY="$APPLY" \
  "$CONTAINER" node -e '
const fs = require("fs");
const path = require("path");

const campaignId = String(process.env.PELLI_ID || "").trim();
const nameQuery = String(process.env.NAME_QUERY || "pelli").trim().toLowerCase();
const claudinei = String(process.env.CLAUDINEI_EMAIL || "").trim().toLowerCase();
const apply = String(process.env.APPLY || "1").trim() !== "0";
const dataDir = "/app/data";
const intakesFile = path.join(dataDir, "waba-campaign-intakes.json");
const usersFile = path.join(dataDir, "waba-system-users.json");
const splitFile = path.join(dataDir, "waba-financeiro-split-config.json");
const norm = (v) => String(v || "").trim().toLowerCase();
const fold = (v) => norm(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const read = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
};
const write = (file, value) => {
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};

const snapshot = (row) => ({
  id: row.id,
  campaignName: row.campaignName,
  status: row.status,
  apiKind: row.apiKind || null,
  ownerEmail: row.ownerEmail,
  plannedSendCount: row.plannedSendCount,
  assignedOperacionalEmail: row.assignedOperacionalEmail || null,
  assignedSupplierId: row.assignedSupplierId || null,
  assignedAt: row.assignedAt || null,
  startedAt: row.startedAt || null,
  startedByEmail: row.startedByEmail || null,
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
  supplierPayoutSettlementId: row.supplierPayoutSettlementId || null,
  payoutApproval: row.payoutApproval ? row.payoutApproval.status : null,
  performanceReport: row.performanceReport ? {
    sent: row.performanceReport.sent,
    delivered: row.performanceReport.delivered,
    read: row.performanceReport.read,
    failed: row.performanceReport.failed,
    clicks: row.performanceReport.clicks,
    filledAt: row.performanceReport.filledAt || "",
    source: row.performanceReport.source || null,
  } : null,
});

const users = read(usersFile, { version: 1, users: [] });
const op = (users.users || []).find((u) => norm(u.email) === claudinei);
if (!op || op.role !== "operacional") {
  console.error(JSON.stringify({ ok: false, error: "Claudinei operacional não encontrado", email: claudinei }));
  process.exit(1);
}

const split = read(splitFile, { suppliers: [] });
const suppliers = Array.isArray(split.suppliers) ? split.suppliers : [];
const store = read(intakesFile, { version: 1, intakes: [] });
if (!store || store.version !== 1 || !Array.isArray(store.intakes)) {
  console.error(JSON.stringify({ ok: false, error: "Store de campanhas inválido" }));
  process.exit(1);
}

const rows = store.intakes;
const byId = campaignId ? rows.findIndex((row) => String(row.id || "") === campaignId) : -1;
const named = rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => {
    const blob = fold((row.campaignName || "") + " " + (row.ownerEmail || ""));
    return blob.includes(fold(nameQuery)) || blob.includes("agenda pessoal");
  })
  .sort((a, b) => Date.parse(b.row.updatedAt || b.row.createdAt || 0) - Date.parse(a.row.updatedAt || a.row.createdAt || 0));

let index = byId;
if (index < 0 && named.length === 1) index = named[0].index;
if (index < 0 && named.length > 1) {
  const agenda = named.filter(({ row }) => fold(row.campaignName || "").includes("agenda pessoal"));
  if (agenda.length === 1) index = agenda[0].index;
}

if (index < 0) {
  console.log(JSON.stringify({
    ok: false,
    error: "Campanha não encontrada pelo UUID; candidatos pelo nome",
    campaignId: campaignId || null,
    nameQuery,
    matches: named.map(({ row }) => snapshot(row)),
    recent: rows.slice(0, 20).map((row) => snapshot(row)),
  }, null, 2));
  process.exit(2);
}

const before = store.intakes[index];
const report = before.performanceReport || null;

if (!apply) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    matchedBy: byId >= 0 ? "id" : "name",
    before: snapshot(before),
    matches: named.map(({ row }) => snapshot(row)),
  }, null, 2));
  process.exit(0);
}

const alreadyOpen =
  String(before.status || "") === "generated" &&
  norm(before.assignedOperacionalEmail) === claudinei &&
  !before.startedAt &&
  !before.performanceReport &&
  !before.errorReport;

if (alreadyOpen) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "já está aguardando configuração na fila do Claudinei, sem indicadores",
    before: snapshot(before),
    after: snapshot(before),
  }, null, 2));
  process.exit(0);
}

const apiKind = String(before.apiKind || "oficial").trim() || "oficial";
const supplier =
  suppliers.find((row) => norm(row.systemUserEmail) === claudinei && String(row.apiKind || "") === apiKind) ||
  suppliers.find((row) => norm(row.systemUserEmail) === claudinei) ||
  null;
const supplierId = supplier
  ? String(supplier.id || "").trim()
  : "manual-negociosltda01-gmail-com-" + apiKind + "-outros";

const now = new Date().toISOString();
const history = Array.isArray(before.assignmentHistory) ? before.assignmentHistory.slice() : [];
history.push({
  at: now,
  supplierId,
  operacionalEmail: claudinei,
  reason: "manual_master",
});

const backup = intakesFile + ".bak-reopen-pelli-" + now.replace(/[:.]/g, "-");
fs.copyFileSync(intakesFile, backup);

const next = Object.assign({}, before, {
  status: "generated",
  assignedOperacionalEmail: claudinei,
  assignedSupplierId: supplierId,
  assignedAt: now,
  assignmentHistory: history,
  updatedAt: now,
});
delete next.startedAt;
delete next.startedByEmail;
delete next.performanceReport;
delete next.errorReport;
delete next.payoutApproval;
delete next.bmInoperanteRegisteredAt;
delete next.masterOverdueAlertSentAt;
delete next.scheduledSendAt;

store.intakes[index] = next;
write(intakesFile, store);

console.log(JSON.stringify({
  ok: true,
  skipped: false,
  matchedBy: byId >= 0 ? "id" : "name",
  backup,
  claudinei: { email: op.email, fullName: op.fullName || null, supplierId },
  keptPayoutSettlementId: before.supplierPayoutSettlementId || null,
  previousIndicators: report ? {
    sent: report.sent,
    delivered: report.delivered,
    read: report.read,
    failed: report.failed,
    clicks: report.clicks,
  } : null,
  before: snapshot(before),
  after: snapshot(next),
  hint: "Fila do operacional = Aguardando configuração. Indicadores apagados. Split já pago (se houver) foi preservado. Regra de distribuição não foi alterada.",
}, null, 2));
'
