#!/bin/bash
# SOMENTE LEITURA. Não altera campanha, fila nem fornecedor.
# Compara a Pelli com a campanha simulada do Douglas.
set -euo pipefail

PELLI_ID="${CAMPAIGN_ID:-1f625e89-cd14-4a3b-9be4-d245257ce88b}"
DOUGLAS_EMAIL="${DOUGLAS_EMAIL:-op_douglas@draxsistemas.com.br}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v02|v01' | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "ERRO: container waba_disparador não encontrado"
  exit 1
fi

echo "Container: $CONTAINER (somente leitura)"
docker exec -e PELLI_ID="$PELLI_ID" -e DOUGLAS_EMAIL="$DOUGLAS_EMAIL" "$CONTAINER" node -e '
const fs = require("fs");
const path = require("path");
const pelliId = String(process.env.PELLI_ID || "").trim();
const douglas = String(process.env.DOUGLAS_EMAIL || "").trim().toLowerCase();
const dataDir = "/app/data";
const read = (name, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")); }
  catch { return fallback; }
};
const norm = (v) => String(v || "").trim().toLowerCase();

const users = read("waba-system-users.json", { version: 1, users: [] });
const split = read("waba-financeiro-split-config.json", { suppliers: [] });
const intakes = read("waba-campaign-intakes.json", { version: 1, intakes: [] });
const rows = Array.isArray(intakes.intakes) ? intakes.intakes : [];

const summarizeUser = (u) => u && ({
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  apis: u.operacionalDispatchesApis || u.operacionalDispatchesApi || null,
  segments: u.operacionalSegments || u.operacionalSegment || null,
});

const pelli = rows.find((row) => String(row.id) === pelliId) || null;
const simulated = rows.filter((row) => {
  const name = String(row.campaignName || "");
  const owner = norm(row.ownerEmail);
  const requestId = String(row.clientRequestId || "");
  return name.indexOf("SIMULAÇÃO Relatório Douglas") >= 0
    || owner === "simulacao.payout.douglas@draxsistemas.com.br"
    || requestId.indexOf("simulate-payout-douglas") === 0;
});

const douglasOnPelli = pelli && (
  norm(pelli.assignedOperacionalEmail) === douglas
  || norm(pelli.startedByEmail) === douglas
  || (Array.isArray(pelli.assignmentHistory) && pelli.assignmentHistory.some((h) => norm(h.operacionalEmail) === douglas))
);

const history = Array.isArray(pelli && pelli.assignmentHistory) ? pelli.assignmentHistory : [];
const firstAssign = history[0] || null;
const lastAssign = history.length ? history[history.length - 1] : null;
const assignedAtMs = pelli && pelli.assignedAt ? Date.parse(pelli.assignedAt) : NaN;
const createdAtMs = pelli && pelli.createdAt ? Date.parse(pelli.createdAt) : NaN;
const simCreated = simulated.map((row) => Date.parse(row.createdAt || "")).filter((n) => !Number.isNaN(n));
const simMin = simCreated.length ? Math.min.apply(null, simCreated) : NaN;

let verdict = "inconclusivo";
let reason = "";
if (!pelli) {
  verdict = "pelli_nao_encontrada";
  reason = "A campanha 1f625e89-… não está no JSON.";
} else if (simulated.length === 0) {
  verdict = "simulacao_nao_encontrada";
  reason = "Não há campanha SIMULAÇÃO Relatório Douglas no JSON. O script de simulação pode não ter rodado neste arquivo.";
} else if (norm(pelli.assignedOperacionalEmail) !== douglas) {
  verdict = "pelli_nao_esta_com_douglas";
  reason = "A Pelli não está atribuída ao e-mail do Douglas agora.";
} else if (firstAssign && String(firstAssign.reason || "") === "initial" && norm(firstAssign.operacionalEmail) === douglas) {
  verdict = "douglas_na_criacao";
  reason = "O histórico inicial (reason=initial) já aponta o Douglas. A simulação posterior não explica essa atribuição.";
} else if (!Number.isNaN(createdAtMs) && !Number.isNaN(assignedAtMs) && Math.abs(assignedAtMs - createdAtMs) < 120000 && (!history.length || String(firstAssign && firstAssign.reason || "") === "initial")) {
  verdict = "douglas_perto_da_criacao";
  reason = "assignedAt está junto da criação da Pelli (25/09). A simulação do dia 27 não é a origem.";
} else if (!Number.isNaN(simMin) && !Number.isNaN(assignedAtMs) && assignedAtMs >= simMin - 60000) {
  verdict = "atribuicao_depois_da_simulacao";
  reason = "assignedAt da Pelli é igual ou posterior à campanha simulada. Pode ter havido escrita no JSON depois do script; o script commitado não altera outras campanhas.";
} else {
  verdict = "pelli_com_douglas_antes_da_simulacao";
  reason = "A Pelli já estava com o Douglas antes do createdAt da campanha simulada. O script de simulação não é a causa.";
}

const suppliers = (split.suppliers || []).map((row) => ({
  name: row.name,
  email: row.systemUserEmail,
  apiKind: row.apiKind,
  segment: row.segment,
  priority: row.priority,
  active: row.active !== false,
  id: row.id,
  isDouglas: norm(row.systemUserEmail) === douglas,
}));

console.log(JSON.stringify({
  ok: true,
  readOnly: true,
  verdict,
  reason,
  douglasOnPelli,
  pelli: pelli && {
    id: pelli.id,
    campaignName: pelli.campaignName,
    status: pelli.status,
    apiKind: pelli.apiKind,
    ownerEmail: pelli.ownerEmail,
    plannedSendCount: pelli.plannedSendCount,
    createdAt: pelli.createdAt,
    assignedAt: pelli.assignedAt,
    assignedOperacionalEmail: pelli.assignedOperacionalEmail,
    assignedSupplierId: pelli.assignedSupplierId,
    startedByEmail: pelli.startedByEmail,
    startedAt: pelli.startedAt,
    clientRequestId: pelli.clientRequestId || null,
    assignmentHistory: history,
  },
  simulatedCampaigns: simulated.map((row) => ({
    id: row.id,
    campaignName: row.campaignName,
    status: row.status,
    ownerEmail: row.ownerEmail,
    plannedSendCount: row.plannedSendCount,
    createdAt: row.createdAt,
    assignedOperacionalEmail: row.assignedOperacionalEmail,
    startedByEmail: row.startedByEmail,
    clientRequestId: row.clientRequestId || null,
    sameIdAsPelli: String(row.id) === pelliId,
  })),
  douglasUser: summarizeUser((users.users || []).find((u) => norm(u.email) === douglas)),
  suppliers,
  hint: "Este script não grava nada. A regra de fila não foi consultada nem alterada.",
}, null, 2));
'
