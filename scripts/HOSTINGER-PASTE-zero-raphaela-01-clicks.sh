#!/bin/bash
# Zera os 41 cliques forçados da Raphaela 01 no JSON.
# O card de cliques continua; as leituras da URL curta passam a popular o indicador.
# NÃO altera status, fila, nem a regra de distribuição. NÃO Redeploy.
set -euo pipefail

SUBSCRIBER_ID="${SUBSCRIBER_ID:-072f2833-9caf-4d86-b30f-a489adf558bb}"
CAMPAIGN_NAME="${CAMPAIGN_NAME:-Raphaela 01}"

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
  -e SUBSCRIBER_ID="$SUBSCRIBER_ID" \
  -e CAMPAIGN_NAME="$CAMPAIGN_NAME" \
  "$CONTAINER" node -e '
const fs = require("fs");
const path = require("path");

const subscriberId = String(process.env.SUBSCRIBER_ID || "").trim();
const campaignName = String(process.env.CAMPAIGN_NAME || "Raphaela 01").trim();
const dataDir = "/app/data";
const intakesFile = path.join(dataDir, "waba-campaign-intakes.json");
const subscribersFile = path.join(dataDir, "waba-subscribers.json");
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

const store = read(intakesFile, { version: 1, intakes: [] });
if (!store || store.version !== 1 || !Array.isArray(store.intakes)) {
  console.error(JSON.stringify({ ok: false, error: "Store de campanhas inválido" }));
  process.exit(1);
}

const subscribers = read(subscribersFile, { version: 1, subscribers: [] });
const subscriber = (subscribers.subscribers || []).find((row) => String(row.id || "") === subscriberId) || null;
const ownerEmail = subscriber ? norm(subscriber.email) : "";
const nameFold = fold(campaignName);
const named = store.intakes
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => {
    if (fold(row.campaignName || "") !== nameFold) return false;
    if (!ownerEmail) return true;
    return norm(row.ownerEmail) === ownerEmail;
  })
  .sort((a, b) => Date.parse(b.row.updatedAt || b.row.createdAt || 0) - Date.parse(a.row.updatedAt || a.row.createdAt || 0));

if (!named.length) {
  console.log(JSON.stringify({ ok: false, error: "Campanha Raphaela 01 não encontrada", subscriberId, ownerEmail: ownerEmail || null }, null, 2));
  process.exit(2);
}

const index = named[0].index;
const before = store.intakes[index];
const report = before.performanceReport || null;
const previousClicks = report ? Math.round(Number(report.clicks || 0)) : null;

if (!report) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "sem performanceReport gravado; cliques na tela vêm do overlay em memória",
    campaignId: before.id,
    campaignName: before.campaignName,
    status: before.status,
    previousClicks: null,
  }, null, 2));
  process.exit(0);
}

if (previousClicks === 0) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "cliques do JSON já estão em 0",
    campaignId: before.id,
    previousClicks: 0,
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const backup = intakesFile + ".bak-zero-raphaela-clicks-" + now.replace(/[:.]/g, "-");
fs.copyFileSync(intakesFile, backup);

const next = Object.assign({}, before, {
  performanceReport: Object.assign({}, report, { clicks: 0 }),
  updatedAt: now,
});
store.intakes[index] = next;
write(intakesFile, store);

console.log(JSON.stringify({
  ok: true,
  skipped: false,
  backup,
  campaignId: before.id,
  campaignName: before.campaignName,
  status: before.status,
  previousClicks,
  clicks: 0,
  hint: "JSON de cliques zerado. Leituras futuras da URL curta passam a popular o card depois que o overlay de 41 sair do processo.",
}, null, 2));
'
