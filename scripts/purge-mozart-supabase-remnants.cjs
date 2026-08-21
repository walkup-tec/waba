#!/usr/bin/env node
/**
 * Limpa Supabase de resquícios das instâncias (após purge EVO/VPS).
 * Não apaga walkup/soma-crm por padrão.
 *
 * Uso: node scripts/purge-mozart-supabase-remnants.cjs [envPath]
 */
const fs = require("fs");

const envPath = process.argv[2] || "E:/01A-Drax-Servidor/Waba/.env";
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const SB = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const PROTECT = new Set(["walkup", "soma-crm"]);

async function sb(method, path, body) {
  const res = await fetch(`${SB}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "DELETE" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: res.status, json, text };
}

async function main() {
  // Lista candidatas conhecidas do aquecedor (além do que o VPS apagar)
  const names = [
    "1321",
    "1321-01",
    "1261",
    "6011",
    "6635",
    "8927",
    "8918",
    "6019-01",
    "6973",
    "final-1267",
    "diagqr01",
    "diagqr02",
    "6034",
    "atendimento-8927",
    "atendimento-8918",
    "7943",
    "suzi",
    "soma",
    "soma-promotora",
    "digital-corban-2477",
    "drax-oficial",
  ].filter((n) => !PROTECT.has(n.toLowerCase()));

  console.log("Supabase scrub instances:", names.length);

  for (const name of names) {
    const enc = encodeURIComponent(name);
    // controle_instancia
    let r = await sb(
      "DELETE",
      `/rest/v1/controle_instancia?instancia=eq.${enc}`,
    );
    console.log("controle_instancia", name, r.status, Array.isArray(r.json) ? r.json.length : "");

    r = await sb("DELETE", `/rest/v1/aquecedor?instancia=eq.${enc}`);
    console.log("aquecedor", name, r.status);

    r = await sb(
      "DELETE",
      `/rest/v1/instancias_uso_config?instance_name=eq.${enc}`,
    );
    console.log("instancias_uso_config", name, r.status);
  }

  // logs_envios — opcional: não apagar histórico financeiro global; só se quiser zero total
  if (process.env.PURGE_LOGS_ENVIOS === "1") {
    for (const name of names) {
      const enc = encodeURIComponent(name);
      await sb("DELETE", `/rest/v1/logs_envios?instancia_origem=eq.${enc}`);
      await sb("DELETE", `/rest/v1/logs_envios?instancia_destino=eq.${enc}`);
      console.log("logs_envios scrub", name);
    }
  } else {
    console.log("logs_envios preservados (set PURGE_LOGS_ENVIOS=1 para apagar)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
