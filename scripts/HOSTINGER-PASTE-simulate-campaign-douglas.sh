#!/bin/bash
# Cria uma campanha em andamento para o operacional Douglas
# (op_douglas@draxsistemas.com.br) finalizar o relatório + print.
# 100% bônus: o master pode testar "Aprovar pagamento" sem Pix Asaas.
# NÃO Redeploy. Idempotente no mesmo dia.
set -euo pipefail

EMAIL="${SIMULATE_OP_EMAIL:-op_douglas@draxsistemas.com.br}"
NAME="${SIMULATE_CAMPAIGN_NAME:-SIMULAÇÃO Relatório Douglas}"
COUNT="${SIMULATE_SEND_COUNT:-1000}"
DAY="$(date +%Y%m%d)"
REQUEST_ID="${SIMULATE_REQUEST_ID:-simulate-payout-douglas-${DAY}}"

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
docker exec -e SIM_EMAIL="$EMAIL" -e SIM_NAME="$NAME" -e SIM_COUNT="$COUNT" -e SIM_REQUEST_ID="$REQUEST_ID" \
  "$CONTAINER" node -e '
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const email = String(process.env.SIM_EMAIL || "").trim().toLowerCase();
const campaignName = String(process.env.SIM_NAME || "").trim();
const planned = Math.max(1, Math.round(Number(process.env.SIM_COUNT || 1000)));
const requestId = String(process.env.SIM_REQUEST_ID || "").trim();
const dataDir = "/app/data";
const intakesFile = path.join(dataDir, "waba-campaign-intakes.json");
const usersFile = path.join(dataDir, "waba-system-users.json");
const subsFile = path.join(dataDir, "waba-subscribers.json");
const splitFile = path.join(dataDir, "waba-financeiro-split-config.json");

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => {
  const tmp = file + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};

const users = readJson(usersFile, { version: 1, users: [] });
const op = (users.users || []).find((u) => String(u.email || "").trim().toLowerCase() === email);
if (!op) {
  console.error(JSON.stringify({ ok: false, error: "operador não encontrado", email }));
  process.exit(1);
}

const apis = Array.isArray(op.operacionalDispatchesApis) && op.operacionalDispatchesApis.length
  ? op.operacionalDispatchesApis
  : (op.operacionalDispatchesApi ? [op.operacionalDispatchesApi] : []);
const segments = Array.isArray(op.operacionalSegments) && op.operacionalSegments.length
  ? op.operacionalSegments
  : (op.operacionalSegment ? [op.operacionalSegment] : []);
if (!apis.length) {
  console.error(JSON.stringify({ ok: false, error: "Douglas sem API operacional marcada", email, role: op.role }));
  process.exit(1);
}
if (!segments.length) {
  console.error(JSON.stringify({ ok: false, error: "Douglas sem segmento operacional marcado", email, role: op.role }));
  process.exit(1);
}

const menus = op.menuPermissions && typeof op.menuPermissions === "object" ? op.menuPermissions : {};
const hasDisparoCloud = menus["whatsapp-disparo-cloud"] === true;
const apiKind = apis.includes("alternativa") ? "alternativa" : apis[0];
const segment = segments.includes("outros") ? "outros" : segments[0];

const intakesStore = readJson(intakesFile, { version: 1, intakes: [] });
if (!Array.isArray(intakesStore.intakes)) intakesStore.intakes = [];
const existing = intakesStore.intakes.find((row) => String(row.clientRequestId || "").trim() === requestId);
if (existing && existing.status === "in_progress") {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    id: existing.id,
    campaignName: existing.campaignName,
    status: existing.status,
    assignedOperacionalEmail: existing.assignedOperacionalEmail,
    apiKind: existing.apiKind,
    hasDisparoCloud,
    hint: hasDisparoCloud
      ? "AVISO: Douglas tem Disparo Cloud — o relatório NÃO será manual (sem modal de print)."
      : "Login como Douglas → Campanhas → " + existing.campaignName + " → preencher indicadores → Campanha Finalizada → enviar o print.",
  }, null, 2));
  process.exit(0);
}

const ownerEmail = "simulacao.payout.douglas@draxsistemas.com.br";
const subsStore = readJson(subsFile, { version: 1, subscribers: [] });
if (!Array.isArray(subsStore.subscribers)) subsStore.subscribers = [];
let subscriber = subsStore.subscribers.find((s) => String(s.email || "").trim().toLowerCase() === ownerEmail);
if (!subscriber) {
  const nowSub = new Date().toISOString();
  subscriber = {
    id: crypto.randomUUID(),
    email: ownerEmail,
    passwordHash: "!",
    fullName: "Simulação Payout Douglas",
    whatsapp: "",
    phone: "",
    cpfCnpj: "",
    segment,
    visibleToMasters: true,
    createdByEmail: email,
    createdAt: nowSub,
    updatedAt: nowSub,
  };
  subsStore.subscribers.push(subscriber);
  writeJson(subsFile, subsStore);
} else if ((subscriber.segment || "outros") !== segment) {
  subscriber.segment = segment;
  subscriber.updatedAt = new Date().toISOString();
  writeJson(subsFile, subsStore);
}

const split = readJson(splitFile, { suppliers: [] });
const supplier = (split.suppliers || []).find((row) => String(row.systemUserEmail || "").trim().toLowerCase() === email) || null;

const id = crypto.randomUUID();
const destDir = path.join(dataDir, "campaign-intakes", id);
fs.mkdirSync(destDir, { recursive: true });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const imageName = "simulacao-douglas.png";
const imagePath = path.join(destDir, imageName);
fs.writeFileSync(imagePath, png);

const sheetName = "leads-" + planned + "-envios.txt";
const sheetPath = path.join(destDir, sheetName);
const lines = [];
for (let i = 0; i < planned; i += 1) {
  lines.push("1199" + String(10000000 + i).slice(-8));
}
fs.writeFileSync(sheetPath, lines.join("\n") + "\n");

const now = new Date().toISOString();
const intake = {
  id,
  ownerEmail,
  campaignName,
  regionDdd: "11",
  whatsappName: "Simulação Douglas",
  textOptions: [
    "Olá, informamos que sua confirmação foi atualizada.",
    "Olá, informamos que o status foi confirmado.",
    "Olá, informamos que a solicitação foi concluída.",
  ],
  responseLink: "https://wabadisparos.com.br/",
  campaignMediaKind: "image",
  imageFileName: imageName,
  imageStoredPath: imagePath,
  spreadsheetFileName: sheetName,
  spreadsheetStoredPath: sheetPath,
  spreadsheetTrimmedPath: sheetPath,
  spreadsheetTrimmedFileName: sheetName,
  importedLineCount: planned,
  plannedSendCount: planned,
  creditFunding: { fromPaid: 0, fromBonus: planned },
  apiKind,
  status: "in_progress",
  startedAt: now,
  startedByEmail: email,
  assignedOperacionalEmail: email,
  assignedSupplierId: supplier && supplier.id ? supplier.id : ("forced-" + email.replace(/[^a-z0-9]+/gi, "-") + "-" + apiKind + "-" + segment),
  assignedAt: now,
  assignmentHistory: [{
    at: now,
    supplierId: supplier && supplier.id ? supplier.id : "simulate",
    operacionalEmail: email,
    reason: "manual_master",
  }],
  clientRequestId: requestId,
  submissionFingerprint: requestId + ":" + planned,
  createdAt: now,
  updatedAt: now,
};

intakesStore.intakes.unshift(intake);
writeJson(intakesFile, intakesStore);

console.log(JSON.stringify({
  ok: true,
  skipped: false,
  id,
  campaignName,
  status: intake.status,
  assignedOperacionalEmail: email,
  assignedOperacionalName: op.fullName,
  apiKind,
  segment,
  plannedSendCount: planned,
  creditFunding: intake.creditFunding,
  hasDisparoCloud,
  ownerEmail,
  subscriberName: subscriber.fullName,
  hint: hasDisparoCloud
    ? "AVISO: Douglas tem Disparo Cloud — o relatório NÃO será o fluxo manual de print."
    : "Login: " + email + " → Campanhas → \"" + campaignName + "\" → preencher Enviados/Entregues/Lidos/Falhados → Campanha Finalizada → enviar o print. Créditos 100% bônus: Aprovar pagamento não dispara Pix.",
}, null, 2));
'
