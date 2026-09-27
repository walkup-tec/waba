#!/bin/bash
# Diagnóstico + transferência da campanha Pelli para o Claudinei.
# Campanha: 1f625e89-cd14-4a3b-9be4-d245257ce88b
# Destino: negociosltda01@gmail.com
# Não Redeploy. Não HUP.
set -euo pipefail

CAMPAIGN_ID="${CAMPAIGN_ID:-1f625e89-cd14-4a3b-9be4-d245257ce88b}"
TARGET_EMAIL="${TARGET_EMAIL:-negociosltda01@gmail.com}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v02|v01' | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "ERRO: container waba_disparador não encontrado"
  exit 1
fi

echo "Container: $CONTAINER"
docker exec -e CAMPAIGN_ID="$CAMPAIGN_ID" -e TARGET_EMAIL="$TARGET_EMAIL" "$CONTAINER" node -e '
const fs = require("fs");
const path = require("path");
const campaignId = String(process.env.CAMPAIGN_ID || "").trim();
const targetEmail = String(process.env.TARGET_EMAIL || "").trim().toLowerCase();
const dataDir = "/app/data";
const read = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")); }
  catch { return fallback; }
};
const write = (name, value) => {
  const file = path.join(dataDir, name);
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};
const norm = (v) => String(v || "").trim().toLowerCase();

const users = read("waba-system-users.json", { version: 1, users: [] });
const split = read("waba-financeiro-split-config.json", { suppliers: [] });
const intakes = read("waba-campaign-intakes.json", { version: 1, intakes: [] });

const summarizeUser = (u) => u && ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  apis: u.operacionalDispatchesApis || u.operacionalDispatchesApi || null,
  segments: u.operacionalSegments || u.operacionalSegment || null,
});

const interesting = (users.users || []).filter((u) => {
  const email = norm(u.email);
  const name = String(u.fullName || "").toLowerCase();
  return email.includes("douglas") || email.includes("drax") || email.includes("claudinei")
    || email === targetEmail || name.includes("douglas") || name.includes("drax") || name.includes("claudinei");
}).map(summarizeUser);

const suppliers = (split.suppliers || []).map((row) => ({
  name: row.name,
  email: row.systemUserEmail,
  apiKind: row.apiKind,
  segment: row.segment,
  priority: row.priority,
  active: row.active !== false,
  id: row.id,
}));

const campaign = (intakes.intakes || []).find((row) => String(row.id) === campaignId);
if (!campaign) {
  console.log(JSON.stringify({ ok: false, error: "campanha não encontrada", campaignId, interesting, suppliers }, null, 2));
  process.exit(1);
}

const targetUser = (users.users || []).find((u) => norm(u.email) === targetEmail);
const whiteOficial = (split.suppliers || []).find((row) =>
  norm(row.systemUserEmail) === targetEmail
  && (row.apiKind === "oficial" || !row.apiKind)
  && (row.segment === "outros" || row.segment === "white" || !row.segment)
  && row.active !== false
);

console.log(JSON.stringify({
  ok: true,
  phase: "diagnostico",
  campaign: {
    id: campaign.id,
    campaignName: campaign.campaignName,
    status: campaign.status,
    apiKind: campaign.apiKind,
    assignedOperacionalEmail: campaign.assignedOperacionalEmail,
    assignedSupplierId: campaign.assignedSupplierId,
    startedByEmail: campaign.startedByEmail,
    assignmentHistory: campaign.assignmentHistory || [],
    ownerEmail: campaign.ownerEmail,
  },
  users: interesting,
  targetUser: summarizeUser(targetUser),
  suppliers,
  claudineiWhiteOficialSupplier: whiteOficial || null,
}, null, 2));

if (!targetUser || targetUser.role !== "operacional") {
  console.error("ERRO: " + targetEmail + " não é usuário operacional.");
  process.exit(2);
}

const now = new Date().toISOString();
const supplierId = whiteOficial && whiteOficial.id ? whiteOficial.id : ("manual-" + targetEmail.replace(/[^a-z0-9]+/gi, "-") + "-oficial-outros");
const history = Array.isArray(campaign.assignmentHistory) ? campaign.assignmentHistory.slice() : [];
history.push({
  at: now,
  supplierId,
  operacionalEmail: targetEmail,
  reason: "manual_master",
});
campaign.assignedOperacionalEmail = targetEmail;
campaign.assignedSupplierId = supplierId;
campaign.assignedAt = now;
campaign.updatedAt = now;
campaign.assignmentHistory = history;
campaign.bmInoperanteRegisteredAt = undefined;
campaign.masterOverdueAlertSentAt = undefined;
write("waba-campaign-intakes.json", intakes);

console.log(JSON.stringify({
  ok: true,
  phase: "atribuido",
  id: campaign.id,
  campaignName: campaign.campaignName,
  assignedOperacionalEmail: campaign.assignedOperacionalEmail,
  assignedSupplierId: campaign.assignedSupplierId,
  hint: "Atualize a tela de Campanhas. Deve aparecer Claudinei. Sem Redeploy.",
}, null, 2));
'
