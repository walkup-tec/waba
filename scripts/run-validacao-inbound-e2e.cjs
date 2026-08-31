#!/usr/bin/env node
/**
 * E2E: validação inbound CONFIRMAR (Evolution sendText + detecção findMessages).
 *
 * Uso:
 *   EVO_API_URL=... EVO_TLS_INSECURE=1 node scripts/run-validacao-inbound-e2e.cjs
 *   E2E_TARGET_INSTANCE=walkup E2E_SENDER_INSTANCE=drax-oficial node scripts/...
 */
require("dotenv").config();
process.env.WABA_PUBLIC_BASE_URL =
  process.env.WABA_PUBLIC_BASE_URL || "https://waba.draxsistemas.com.br";

const {
  startInboundValidation,
  getInboundValidationStatus,
  refreshInboundValidation,
} = require("../dist/instance-inbound-validation.service.js");
const {
  evoHttpRequest,
  defaultEvoSendTextTimeoutMs,
} = require("../dist/evo-http.client.js");
const {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
} = require("../dist/instances/evo-connection-state.service.js");

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const TARGET = String(process.env.E2E_TARGET_INSTANCE || "walkup").trim();
const SENDER = String(process.env.E2E_SENDER_INSTANCE || "drax-oficial").trim();

function parseList(json) {
  if (Array.isArray(json)) return json;
  if (json?.response) return json.response;
  if (json?.data) return json.data;
  return [];
}

function pickPhone(row) {
  const raw = String(row?.ownerJid || row?.owner || row?.number || "").trim();
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const digits = base.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

async function waitOpen(name, maxMs = 90_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const st = await fetchEvoInstanceLiveState(name, { fresh: true });
    if (isEvoLiveStateOpen(st)) return st;
    if (st === "close") return st;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fetchEvoInstanceLiveState(name, { fresh: true });
}

async function main() {
  if (!EVO_API_BASE) {
    console.error("Defina EVO_API_URL");
    process.exit(1);
  }

  console.log(`E2E validação: alvo=${TARGET} remetente=${SENDER}`);
  const state = await waitOpen(TARGET, 30_000);
  if (!isEvoLiveStateOpen(state)) {
    console.error(`Alvo ${TARGET} não está open (state=${state || "?"}). Escaneie o QR antes do E2E.`);
    process.exit(2);
  }

  const list = await evoHttpRequest(`${EVO_API_BASE}/instance/fetchInstances`, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: 20_000,
    retries: 1,
  });
  const rows = parseList(list.json);
  const targetRow = rows.find((r) => String(r?.name || r?.instanceName) === TARGET);
  const toNumber = pickPhone(targetRow);
  if (!toNumber) {
    console.error("Número do alvo não encontrado em fetchInstances");
    process.exit(3);
  }
  console.log(`Número alvo: ${toNumber}`);

  const started = await startInboundValidation({
    instanceName: TARGET,
    instanceNumberHint: toNumber,
    forceRestart: true,
  });
  if (started.error || !started.validationId) {
    console.error("startInboundValidation:", started.error || "sem validationId");
    process.exit(4);
  }
  const validationId = started.validationId;
  console.log("validationId:", validationId);

  await new Promise((r) => setTimeout(r, 1500));

  const sendUrl = `${EVO_API_BASE}/message/sendText/${encodeURIComponent(SENDER)}`;
  const sendRes = await evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body: { number: toNumber, text: "CONFIRMAR", textMessage: { text: "CONFIRMAR" } },
    timeoutMs: defaultEvoSendTextTimeoutMs(),
    retries: 2,
  });
  console.log(
    "sendText CONFIRMAR:",
    sendRes.status,
    sendRes.ok ? "OK" : String(sendRes.error || sendRes.body).slice(0, 200),
  );
  if (!sendRes.ok) {
    console.error("Falha ao enviar CONFIRMAR — abortando E2E");
    process.exit(5);
  }

  const deadline = Date.now() + 120_000;
  let last = null;
  while (Date.now() < deadline) {
    await refreshInboundValidation(validationId, true);
    last = getInboundValidationStatus(validationId);
    if (!last) break;
    console.log(
      `[poll] phase=${last.phase} recv=${last.receiveTest?.success} send=${last.sendTest?.success} finished=${last.finished}`,
    );
    if (last.finished) break;
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("\n--- RESULTADO ---");
  console.log(JSON.stringify(last, null, 2));

  const ok =
    last?.finished &&
    last.receiveTest?.success === true &&
    last.sendTest?.success === true;
  process.exit(ok ? 0 : 6);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
