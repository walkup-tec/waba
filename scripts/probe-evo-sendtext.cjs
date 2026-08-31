#!/usr/bin/env node
/**
 * Probe real Evolution sendText + findMessages (mesmo cliente HTTP do WABA).
 *
 * Uso:
 *   node scripts/probe-evo-sendtext.cjs
 *   EVO_API_URL=http://172.17.0.1:30181 node scripts/probe-evo-sendtext.cjs --from final-1267 --to 555197979224
 */
const http = require("node:http");
const https = require("node:https");

const args = process.argv.slice(2);
function arg(name, fallback = "") {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? String(args[i + 1]) : fallback;
}

const EVO_API_BASE = String(process.env.EVO_API_URL || "https://walkup-evo-walkup-api.achpyp.easypanel.host").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const FROM = arg("from", "final-1267");
const TO = arg("to", "555197979224");
const TIMEOUT_MS = Math.max(10000, Number(process.env.EVO_SEND_TEXT_TIMEOUT_MS || process.env.EVO_HTTP_TIMEOUT_MS || 90000));

const isTlsInsecure = () => {
  const flag = String(process.env.EVO_TLS_INSECURE ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (/\.easypanel\.host(\/|$)/i.test(EVO_API_BASE)) return true;
  return false;
};

function evoRequest(method, path, body) {
  const url = `${EVO_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const lib = isHttps ? https : http;
  const bodyText = body ? JSON.stringify(body) : "";
  return new Promise((resolve) => {
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
          ...(bodyText ? { "Content-Length": String(Buffer.byteLength(bodyText)) } : {}),
        },
        timeout: TIMEOUT_MS,
        ...(isHttps && isTlsInsecure() ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode || 0, body: text, json });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err) => resolve({ ok: false, status: 0, body: "", json: null, error: err.message }));
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

async function connectionState(name) {
  const enc = encodeURIComponent(name);
  for (const path of [`/instance/connectionState/${enc}`, `/instance/connection-state/${enc}`]) {
    const r = await evoRequest("GET", path);
    if (r.ok && r.json) return r;
    if (r.status !== 404) return r;
  }
  return { ok: false, status: 0, body: "connectionState unavailable", json: null };
}

async function findMessageMarker(destInstance, marker, remoteDigits) {
  const enc = encodeURIComponent(destInstance);
  const jid = `${String(remoteDigits).replace(/\D/g, "")}@s.whatsapp.net`;
  const bodies = [
    { where: { key: { remoteJid: jid } }, limit: 30 },
    { limit: 40 },
    {},
  ];
  for (const body of bodies) {
    const r = await evoRequest("POST", `/chat/findMessages/${enc}`, body);
    if (!r.ok) continue;
    const hay = JSON.stringify(r.json || r.body || "").toLowerCase();
    if (hay.includes(marker.toLowerCase())) return { ok: true, detail: "marker found via findMessages" };
  }
  return { ok: false, detail: "marker not found" };
}

async function main() {
  const marker = `probe${Date.now().toString(36).slice(-6)}`;
  const text = `WABA EVO probe ${marker}`;
  console.log("EVO base:", EVO_API_BASE);
  console.log("FROM:", FROM, "TO:", TO, "timeoutMs:", TIMEOUT_MS);

  const csFrom = await connectionState(FROM);
  const csTo = await connectionState(TO);
  console.log("\nconnectionState FROM:", JSON.stringify(csFrom.json || csFrom.body));
  console.log("connectionState TO:", JSON.stringify(csTo.json || csTo.body));

  const sendBody = {
    number: String(TO).replace(/\D/g, ""),
    text,
    textMessage: { text },
  };
  const sendPaths = [
    `/message/sendText/${encodeURIComponent(FROM)}`,
    `/message/send/${encodeURIComponent(FROM)}`,
  ];

  let sendResult = null;
  for (const path of sendPaths) {
    console.log(`\nPOST ${path} ...`);
    const started = Date.now();
    sendResult = await evoRequest("POST", path, sendBody);
    console.log(
      "send:",
      sendResult.status,
      `${Date.now() - started}ms`,
      sendResult.error || (sendResult.body || "").slice(0, 300),
    );
    if (sendResult.ok) break;
    if (sendResult.status === 404) continue;
  }

  if (!sendResult?.ok) {
    console.error("\nFAIL sendText");
    process.exit(1);
  }

  console.log("\nAguardando 5s e buscando mensagem no destino (instância TO se for nome de instância)...");
  await new Promise((r) => setTimeout(r, 5000));

  const destInstance = arg("dest-instance", TO.includes("@") ? "" : TO);
  if (destInstance) {
    const fromDigits = arg("from-number", "");
    const find = await findMessageMarker(destInstance, marker, fromDigits || FROM);
    console.log("findMessages:", find.ok ? "OK" : "FAIL", find.detail);
    process.exit(find.ok ? 0 : 2);
  }

  console.log("OK send (receive check skipped — passe --dest-instance soma --from-number 555182001267)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
