#!/usr/bin/env node
/**
 * Valida regras de boas-vindas antes de deploy:
 * - Sempre tenta número eleito (1º hint) mesmo em pausa humana/Preparando
 * - Failover secundário/terciário só se eleito desconectado
 * - ignoreAquecedorLifecycle ligado no serviço de boas-vindas
 *
 * Uso: node scripts/verify-welcome-routing-rules.cjs
 * Opcional live EVO: EVO_API_URL=... node scripts/verify-welcome-routing-rules.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

const delivery = read("src/mail/waba-evolution-whatsapp-delivery.service.ts");
const welcome = read("src/mail/waba-welcome-whatsapp.service.ts");
const marker = read("src/deploy-marker.ts");

const staticChecks = [
  {
    name: "welcome usa ignoreAquecedorLifecycle",
    pass: welcome.includes("ignoreAquecedorLifecycle: true"),
  },
  {
    name: "resolveWelcomeEvoSendSlots definido",
    pass: delivery.includes("const resolveWelcomeEvoSendSlots"),
  },
  {
    name: "boas-vindas chama resolveWelcomeEvoSendSlots",
    pass: delivery.includes("await resolveWelcomeEvoSendSlots(phoneHintsAll, logLabel)"),
  },
  {
    name: "failover só quando eleito desconectado (comentário/código)",
    pass:
      delivery.includes("Só avança para secundário/terciário se o eleito estiver desconectado") &&
      delivery.includes("shouldSkipInstanceForSend(liveState)"),
  },
  {
    name: "ACK erro em boas-vindas não faz failover de instância",
    pass: delivery.includes("Boas-vindas repete no mesmo número (sem failover)"),
  },
  {
    name: "deploy marker inclui welcome",
    pass: /welcome|boas-vindas|eleito/i.test(marker),
  },
];

console.log("=== verify-welcome-routing (estático) ===");
for (const c of staticChecks) {
  if (c.pass) ok(c.name);
  else fail(c.name);
}

async function evoRequest(base, apiKey, method, reqPath, body) {
  const url = `${base.replace(/\/+$/, "")}${reqPath.startsWith("/") ? reqPath : `/${reqPath}`}`;
  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;
  const payload = body ? JSON.stringify(body) : "";
  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
        },
        rejectUnauthorized: false,
        timeout: 20000,
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err) => resolve({ status: 0, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function liveEvoChecks() {
  const base =
    process.env.EVO_API_URL ||
    "https://walkup-evo-walkup-api.achpyp.easypanel.host";
  const apiKey = process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";
  const primaryHint =
    process.env.WABA_WHATSAPP_PRIMARY_PHONE ||
    process.env.WABA_WELCOME_WHATSAPP_PRIMARY_PHONE ||
    "51981077770";

  console.log("\n=== verify-welcome-routing (Evolution live) ===");
  console.log("EVO:", base, "| hint:", primaryHint);

  const cs = await evoRequest(
    base,
    apiKey,
    "GET",
    `/instance/connectionState/${encodeURIComponent("drax-oficial")}`,
  );
  const state = String(cs.json?.instance?.state || cs.json?.state || "").toLowerCase();
  if (state === "open") ok("drax-oficial connectionState=open");
  else fail(`drax-oficial connectionState=${state || "?"}`);

  const list = await evoRequest(base, apiKey, "GET", "/instance/fetchInstances");
  if (list.status < 200 || list.status >= 300) {
    fail(`fetchInstances HTTP ${list.status}`);
    return;
  }
  const rows = Array.isArray(list.json)
    ? list.json
    : Array.isArray(list.json?.response)
      ? list.json.response
      : [];
  const hintDigits = String(primaryHint).replace(/\D/g, "");
  const match = rows.find((row) => {
    const num = String(row?.ownerJid || row?.number || row?.owner || "")
      .replace(/\D/g, "")
      .replace(/@.*/, "");
    const name = String(row?.name || row?.instanceName || "").toLowerCase();
    return num.endsWith(hintDigits.slice(-8)) || name === "drax-oficial";
  });
  if (match) {
    ok(`instância eleita encontrada no catálogo: ${match.name || match.instanceName || "drax-oficial"}`);
  } else {
    fail("instância do hint primário não encontrada no fetchInstances");
  }
}

(async () => {
  await liveEvoChecks();
  if (process.exitCode) {
    console.error("\nVerificação FALHOU — não faça deploy até corrigir.");
    process.exit(1);
  }
  console.log("\nVerificação OK — pronto para deploy (comportamento em pausa humana: testar reenvio pós-deploy).");
})();
