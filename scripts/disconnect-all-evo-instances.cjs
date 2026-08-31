#!/usr/bin/env node
/**
 * Desconecta (logout) todas instâncias Evolution open/connecting — sem deletar.
 *
 * Uso:
 *   node scripts/disconnect-all-evo-instances.cjs
 *   node scripts/disconnect-all-evo-instances.cjs --dry-run
 */
const http = require("node:http");
const https = require("node:https");

const dryRun = process.argv.includes("--dry-run");
const EVO_API_BASE = String(
  process.env.EVO_API_URL || "https://walkup-evo-walkup-api.achpyp.easypanel.host",
).replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11").trim();
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() || `${EVO_API_BASE}/instance/fetchInstances`;

const tlsInsecure = () => {
  const flag = String(process.env.EVO_TLS_INSECURE ?? "").trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  return /\.easypanel\.host(\/|$)/i.test(EVO_API_BASE);
};

function evoRequest(method, path, body) {
  const url = path.startsWith("http") ? path : `${EVO_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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
        timeout: 30_000,
        ...(isHttps && tlsInsecure() ? { rejectUnauthorized: false } : {}),
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

function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.response)) return raw.response;
    if (Array.isArray(raw.data)) return raw.data;
  }
  return [];
}

function pickName(row) {
  return String(row?.name || row?.instanceName || "").trim();
}

function pickFetchStatus(row) {
  return String(row?.connectionStatus || row?.status || "").trim().toLowerCase();
}

function pickLiveState(json) {
  const inst = json?.instance ?? json;
  return String(inst?.state || inst?.connectionStatus || "").trim().toLowerCase();
}

function shouldDisconnect(fetchStatus, liveState) {
  if (fetchStatus.includes("open")) return true;
  if (liveState === "open" || liveState === "connecting") return true;
  return false;
}

async function fetchLiveState(name) {
  const enc = encodeURIComponent(name);
  for (const path of [`/instance/connectionState/${enc}`, `/instance/connection-state/${enc}`]) {
    const r = await evoRequest("GET", path);
    if (r.ok && r.json) return pickLiveState(r.json);
    if (r.status !== 404) return pickLiveState(r.json) || "";
  }
  return "";
}

async function logoutInstance(name) {
  const enc = encodeURIComponent(name);
  return evoRequest("DELETE", `/instance/logout/${enc}`);
}

async function main() {
  console.log(`EVO base: ${EVO_API_BASE}`);
  console.log(dryRun ? "MODO dry-run (nenhum logout executado)" : "Executando logout em instâncias conectadas...");

  const listRes = await evoRequest("GET", EVO_INSTANCES_URL);
  if (!listRes.ok) {
    console.error("fetchInstances falhou:", listRes.status, listRes.body?.slice(0, 200));
    process.exit(1);
  }

  const instances = parseList(listRes.json);
  const targets = [];

  for (const row of instances) {
    const name = pickName(row);
    if (!name) continue;
    const fetchStatus = pickFetchStatus(row);
    const liveState = await fetchLiveState(name);
    if (shouldDisconnect(fetchStatus, liveState)) {
      targets.push({ name, fetchStatus, liveState });
    }
  }

  console.log(`\nInstâncias a desconectar: ${targets.length}`);
  if (!targets.length) {
    console.log("Nenhuma instância open/connecting encontrada.");
    process.exit(0);
  }

  for (const t of targets) {
    console.log(`- ${t.name} (fetch=${t.fetchStatus || "?"}, live=${t.liveState || "?"})`);
  }

  if (dryRun) {
    process.exit(0);
  }

  const results = [];
  for (const t of targets) {
    const r = await logoutInstance(t.name);
    const after = await fetchLiveState(t.name);
    results.push({
      name: t.name,
      logoutStatus: r.status,
      logoutOk: r.ok,
      liveAfter: after || "?",
      detail: String(r.error || r.body || "").slice(0, 120),
    });
    console.log(`  logout ${t.name}: HTTP ${r.status} → live=${after || "?"}`);
    await new Promise((res) => setTimeout(res, 400));
  }

  console.log("\n--- Verificação final ---");
  let stillConnected = 0;
  for (const row of instances) {
    const name = pickName(row);
    if (!name) continue;
    const fetchStatus = pickFetchStatus(row);
    const liveState = await fetchLiveState(name);
    const connected = fetchStatus.includes("open") || liveState === "open" || liveState === "connecting";
    if (connected) {
      stillConnected += 1;
      console.log(`  AINDA conectada: ${name} (fetch=${fetchStatus}, live=${liveState})`);
    }
  }

  if (stillConnected === 0) {
    console.log("\nOK: todas as instâncias desconectadas. Pode reconectar QR no painel WABA.");
    process.exit(0);
  }

  console.log(`\nATENÇÃO: ${stillConnected} instância(s) ainda aparecem conectadas. Pode ser cache EVO — aguarde ~30s e atualize a página, ou reinicie o serviço Evolution.`);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
