#!/usr/bin/env node
/**
 * Valida regras de boas-vindas:
 * - Fila 77770 → 7462102 → 82477; ausente usa o próximo
 * - ignoreAquecedorLifecycle
 * - JID canônico (exists:true)
 * - Fallback qualquer EVO open se a fila falhar
 * - Retry em background até entregar
 *
 * Uso: node scripts/verify-welcome-routing-rules.cjs
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
const exists = read("src/mail/waba-whatsapp-exists-number.ts");
const marker = read("src/deploy-marker.ts");
const rules = read(".cursor/project-memory/02-BUSINESS_RULES.md");

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
    pass: delivery.includes("await resolveWelcomeEvoSendSlots(phoneHints, logLabel)"),
  },
  {
    name: "fila completa com fallback qualquer open",
    pass:
      delivery.includes("allowAnyOpenFallback: true") &&
      delivery.includes("Ausente/desconectado → próximo"),
  },
  {
    name: "não trava no eleito (sem welcomeRetryPrimaryOnly)",
    pass: !delivery.includes("welcomeRetryPrimaryOnly"),
  },
  {
    name: "envia JID canônico exists:true",
    pass:
      exists.includes("pickCanonicalWhatsAppNumberFromExistsCheck") &&
      delivery.includes("whatsappNumbers"),
  },
  {
    name: "retry background até sucesso nas boas-vindas",
    pass:
      delivery.includes("WABA_WELCOME_BACKGROUND_RETRY_MAX") &&
      welcome.includes("backgroundRetryKey"),
  },
  {
    name: "regra permanente: boas-vindas obrigatória no WhatsApp",
    pass: /obrigada a chegar|obrigatória no WhatsApp|sem exceção/i.test(rules),
  },
  {
    name: "deploy marker inclui welcome",
    pass: /welcome|boas-vindas|canonical|fila/i.test(marker),
  },
];

console.log("=== verify-welcome-routing (estático) ===");
for (const c of staticChecks) {
  if (c.pass) ok(c.name);
  else fail(c.name);
}

async function evoRequest(base, apiKey, method, reqPath) {
  const url = `${base.replace(/\/+$/, "")}${reqPath.startsWith("/") ? reqPath : `/${reqPath}`}`;
  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: { apikey: apiKey, "Content-Type": "application/json" },
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
    req.end();
  });
}

function evoName(inst) {
  const nested = inst && inst.instance && typeof inst.instance === "object" ? inst.instance : inst;
  return String(nested.instanceName || nested.name || inst.instanceName || inst.name || "").trim();
}

function evoPhone(inst) {
  const nested = inst && inst.instance && typeof inst.instance === "object" ? inst.instance : inst;
  return String(nested.ownerJid || nested.wuid || nested.owner || nested.number || inst.ownerJid || "").replace(
    /\D/g,
    "",
  );
}

function evoOpen(inst) {
  const nested = inst && inst.instance && typeof inst.instance === "object" ? inst.instance : inst;
  const status = String(nested.connectionStatus || nested.status || inst.connectionStatus || "").toLowerCase();
  return status.includes("open") || status === "connected";
}

async function liveEvoChecks() {
  const base = process.env.EVO_API_URL || "";
  const apiKey = process.env.EVO_API_KEY || "";
  if (!base || !apiKey) {
    console.log("\n=== verify-welcome-routing (Evolution live) ===");
    console.log("skip: EVO_API_URL/EVO_API_KEY ausentes");
    return;
  }

  console.log("\n=== verify-welcome-routing (Evolution live) ===");
  const list = await evoRequest(base, apiKey, "GET", "/instance/fetchInstances");
  if (list.status < 200 || list.status >= 300) {
    fail(`fetchInstances HTTP ${list.status}`);
    return;
  }
  const rows = Array.isArray(list.json) ? list.json : [];
  const hints = ["51981077770", "51997462102", "51981082477"];
  const openInQueue = [];
  for (const hint of hints) {
    const tail = hint.slice(-8);
    const hit = rows.find((row) => {
      const phone = evoPhone(row);
      return phone.endsWith(tail) || phone.endsWith(hint);
    });
    if (hit && evoOpen(hit)) openInQueue.push(`${hint}→${evoName(hit)}`);
  }
  if (openInQueue.length) ok(`fila tem open: ${openInQueue.join(", ")}`);
  else fail("nenhum número da fila 77770→7462102→82477 está open");
}

(async () => {
  await liveEvoChecks();
  if (process.exitCode) {
    console.error("\nVerificação FALHOU — não faça deploy até corrigir.");
    process.exit(1);
  }
  console.log("\nVerificação OK — pronto para deploy.");
})();
