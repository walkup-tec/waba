#!/usr/bin/env node
/**
 * Diagnóstico validação CONFIRMAR para um número/instância.
 * Uso: node scripts/probe-instance-validacao.cjs 5181082477
 */
require("dotenv").config();
const { evoHttpRequest } = require("../dist/evo-http.client.js");
const {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
  invalidateEvoLiveStateCache,
} = require("../dist/instances/evo-connection-state.service.js");
const {
  startInboundValidation,
  getInboundValidationStatus,
  refreshInboundValidation,
} = require("../dist/instance-inbound-validation.service.js");

const phoneArg = String(process.argv[2] || "").replace(/\D/g, "");
const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const WABA_BASE = String(process.env.WABA_PUBLIC_BASE_URL || "https://waba.draxsistemas.com.br").replace(/\/$/, "");

function parseList(json) {
  if (Array.isArray(json)) return json;
  if (json?.response) return json.response;
  if (json?.data) return json.data;
  return [];
}

function pickPhone(row) {
  const raw = String(row?.ownerJid || row?.owner || row?.number || "").trim();
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  return base.replace(/\D/g, "");
}

function phoneVariants(digits) {
  const out = new Set([digits]);
  if (digits.startsWith("55")) out.add(digits.slice(2));
  if (!digits.startsWith("55") && digits.length >= 10) out.add(`55${digits}`);
  if (digits.length > 9) out.add(digits.slice(-9));
  return [...out];
}

async function timed(label, fn) {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  console.log(`[${ms}ms] ${label}`);
  return { result, ms };
}

async function main() {
  if (!phoneArg || !EVO_API_BASE) {
    console.error("Uso: node scripts/probe-instance-validacao.cjs <numero>");
    process.exit(1);
  }

  console.log("=== Probe validação CONFIRMAR ===");
  console.log("Número alvo:", phoneArg);
  console.log("EVO:", EVO_API_BASE);
  console.log("WABA:", WABA_BASE);

  const healthRes = await fetch(`${WABA_BASE}/health`, { signal: AbortSignal.timeout(12000) }).catch(() => null);
  const healthBody = healthRes ? await healthRes.text().catch(() => "") : "";
  console.log("\n[health]", healthRes?.status ?? 0, healthBody.slice(0, 200));

  const listRes = await evoHttpRequest(`${EVO_API_BASE}/instance/fetchInstances`, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: 20000,
    retries: 1,
  });
  if (!listRes.ok) {
    console.error("fetchInstances falhou:", listRes.status, listRes.body?.slice(0, 300));
    process.exit(2);
  }

  const variants = phoneVariants(phoneArg);
  const rows = parseList(listRes.json);
  const matches = rows.filter((r) => {
    const p = pickPhone(r);
    return variants.some((v) => p.endsWith(v) || v.endsWith(p) || p === v);
  });

  console.log(`\nInstâncias Evolution com número ${phoneArg}:`, matches.length);
  for (const row of matches) {
    const name = String(row?.name || row?.instanceName || "").trim();
    invalidateEvoLiveStateCache(name);
    const state = await fetchEvoInstanceLiveState(name, { fresh: true });
    console.log(`  - ${name}: connection=${row?.connectionStatus || row?.state || "?"} live=${state} open=${isEvoLiveStateOpen(state)}`);
  }

  const target = matches[0];
  if (!target) {
    console.error("Nenhuma instância Evolution encontrada para o número.");
    process.exit(3);
  }

  const instanceName = String(target.name || target.instanceName).trim();
  console.log("\n=== Testes na instância:", instanceName, "===");

  const enc = encodeURIComponent(instanceName);
  for (const [label, url, body] of [
    ["findMessages fast fromMe:false", `${EVO_API_BASE}/chat/findMessages/${enc}`, { where: { key: { fromMe: false } }, limit: 60 }],
    ["findMessages limit 60", `${EVO_API_BASE}/chat/findMessages/${enc}`, { limit: 60 }],
    ["findChats", `${EVO_API_BASE}/chat/findChats/${enc}`, { limit: 20 }],
  ]) {
    const { result, ms } = await timed(label, () =>
      evoHttpRequest(url, "POST", { apiKey: EVO_API_KEY, body, timeoutMs: 8000, retries: 0 }),
    );
    console.log(`       HTTP ${result.status} ok=${result.ok} bodyLen=${(result.body || "").length}`);
    if (ms > 3000) console.log("       ⚠ LENTO (>3s)");
  }

  for (const whUrl of [
    `${EVO_API_BASE}/webhook/find/${enc}`,
    `${EVO_API_BASE}/webhook/find/${enc}/webhook`,
  ]) {
    const wh = await evoHttpRequest(whUrl, "GET", { apiKey: EVO_API_KEY, timeoutMs: 10000, retries: 0 });
    console.log(`\n[webhook GET] ${whUrl.split("/").slice(-2).join("/")}: HTTP ${wh.status}`);
    if (wh.ok && wh.json) {
      const j = wh.json;
      const enabled = j?.webhook?.enabled ?? j?.enabled;
      const url = j?.webhook?.url ?? j?.url ?? "";
      console.log(`       enabled=${enabled} url=${String(url).slice(0, 80)}`);
      const expects = `${WABA_BASE}/webhooks/evolution`;
      if (!String(url).includes("webhooks/evolution")) console.log("       ⚠ webhook NÃO aponta para WABA");
      if (!enabled) console.log("       ⚠ webhook DESABILITADO");
    }
  }

  console.log("\n=== Simulação startInboundValidation (sem enviar CONFIRMAR) ===");
  const started = await startInboundValidation({ instanceName, instanceNumberHint: phoneArg, forceRestart: true });
  if (started.error) {
    console.error("start falhou:", started.error);
    process.exit(4);
  }
  const vid = started.validationId;
  console.log("validationId:", vid);
  console.log("webhookConfigured:", started.status?.webhookConfigured);

  const t0 = Date.now();
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const st = getInboundValidationStatus(vid);
    console.log(`  tick ${i + 1} (${Date.now() - t0}ms): receive=${st?.receiveTest?.success} phase=${st?.phase}`);
    if (st?.receiveTest?.success === true) {
      console.log("  ⚠ FALSO POSITIVO? receive OK sem CONFIRMAR enviado");
      break;
    }
  }

  const fast = await timed("refresh nudge fast (deep=false)", () => refreshInboundValidation(vid, { deep: false }));
  console.log("       receive:", fast.result?.receiveTest);

  const deep = await timed("refresh nudge deep", () => refreshInboundValidation(vid, { deep: true, aggressive: false }));
  console.log("       receive:", deep.result?.receiveTest);

  console.log("\nOK — diagnóstico concluído (validação cancelada ao expirar naturalmente).");
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
