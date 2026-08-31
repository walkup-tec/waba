/**
 * Transfere dono de instância em produção via POST /admin/master/promote-from-v02
 * (funciona mesmo sem o endpoint /admin/instances/transfer-owner).
 *
 * Uso:
 *   node scripts/transfer-instance-owner-prod-via-promote.cjs atendimento-6019 walkup@walkuptec.com.br
 *   node scripts/transfer-instance-owner-prod-via-promote.cjs --phone 51982006019 walkup@walkuptec.com.br
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const https = require("node:https");
const http = require("node:http");

const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env"), override: false });

const args = process.argv.slice(2);
const phoneFlagIdx = args.indexOf("--phone");
const phoneArg = phoneFlagIdx >= 0 ? String(args[phoneFlagIdx + 1] || "").trim() : "";
const positional = args.filter((a) => !a.startsWith("--") && a !== phoneArg);
const instanceNameArg = phoneArg ? "" : String(positional[0] || "").trim();
const targetEmail = String(positional[phoneArg ? 0 : 1] || "walkup@walkuptec.com.br")
  .trim()
  .toLowerCase();

const prodBase = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
  /\/+$/,
  "",
);
const loginEmail = String(process.env.WABA_ADMIN_EMAIL || "walkup@walkuptec.com.br").trim();
const loginPassword = String(process.env.WABA_ADMIN_PASSWORD || "").trim();

if (!loginPassword || !targetEmail.includes("@")) {
  console.error("Defina WABA_ADMIN_PASSWORD e informe instância ou --phone.");
  process.exit(1);
}

function readWalkupSystemUser() {
  const usersPath = path.join(ROOT, "data", "v02", "waba-system-users.json");
  const store = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  const user = (store.users || []).find(
    (row) => String(row?.email || "").trim().toLowerCase() === targetEmail,
  );
  if (!user || String(user.role || "").toLowerCase() !== "master") {
    throw new Error(`Master não encontrado em data/v02: ${targetEmail}`);
  }
  return user;
}

function evoRequest(url, method = "GET") {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, status: 0, error: error.message, json: null });
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const insecure =
      String(process.env.EVO_TLS_INSECURE || "").trim() === "1" ||
      /\.easypanel\.host$/i.test(parsed.hostname);
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: { apikey: String(process.env.EVO_API_KEY || ""), "Content-Type": "application/json" },
        ...(parsed.protocol === "https:" && insecure ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {
            json = null;
          }
          resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, status: res.statusCode, json, body });
        });
      },
    );
    req.on("error", (error) => resolve({ ok: false, status: 0, error: error.message, json: null }));
    req.end();
  });
}

function buildPhoneVariants(rawDigits) {
  const digits = String(rawDigits || "").replace(/\D/g, "");
  const out = new Set();
  if (!digits) return out;
  out.add(digits);
  if (digits.startsWith("55")) out.add(digits.slice(2));
  if (digits.length > 8) out.add(digits.slice(-8));
  if (!digits.startsWith("55") && digits.length >= 10) out.add(`55${digits}`);
  return out;
}

function phonesLooselyMatch(queryDigits, instanceDigits) {
  const query = buildPhoneVariants(queryDigits);
  const instance = buildPhoneVariants(instanceDigits);
  for (const value of query) {
    if (instance.has(value)) return true;
  }
  const querySuffixes = [...query].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  const instanceSuffixes = [...instance].map((v) => v.slice(-8)).filter((v) => v.length >= 8);
  return querySuffixes.some((suffix) => instanceSuffixes.includes(suffix));
}

function extractNumber(inst) {
  const raw = inst?.ownerJid ?? inst?.number ?? inst?.phone ?? "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[0].replace(/\D/g, "");
  return s.replace(/\D/g, "");
}

async function resolveInstanceNames() {
  if (instanceNameArg) return [instanceNameArg];
  if (!phoneArg) throw new Error("Informe instanceName ou --phone.");

  const evoBase = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
  const evoUrl =
    String(process.env.EVO_INSTANCES_URL || "").trim() || `${evoBase}/instance/fetchInstances`;
  const evoRes = await evoRequest(evoUrl);
  if (!evoRes.ok) throw new Error(`Evolution indisponível (${evoRes.status})`);
  const list = Array.isArray(evoRes.json)
    ? evoRes.json
    : Array.isArray(evoRes.json?.response)
      ? evoRes.json.response
      : [];
  const matches = list.filter((inst) => {
    const num = extractNumber(inst);
    return num && phonesLooselyMatch(phoneArg, num);
  });
  const names = matches
    .map((inst) => String(inst?.name ?? inst?.instanceName ?? "").trim())
    .filter(Boolean);
  if (!names.length) throw new Error(`Nenhuma instância Evolution para o número ${phoneArg}.`);
  return names;
}

async function login() {
  const res = await fetch(`${prodBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  if (!res.ok) throw new Error(`Login falhou (${res.status})`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Cookie de sessão não recebido.");
  return cookie;
}

async function main() {
  const instanceNames = await resolveInstanceNames();
  const systemUser = readWalkupSystemUser();
  const instanceOwners = Object.fromEntries(
    instanceNames.map((name) => [
      name,
      {
        ownerEmail: targetEmail,
        createdAt: new Date().toISOString(),
      },
    ]),
  );

  const bundle = {
    version: 2,
    kind: "master",
    email: targetEmail,
    systemUser,
    forceInstanceOwnerTransfer: true,
    instanceOwners,
  };

  const cookie = await login();
  const res = await fetch(`${prodBase}/admin/master/promote-from-v02`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(bundle),
  });
  const payload = await res.json().catch(() => ({}));
  console.log(
    JSON.stringify(
      {
        ok: res.ok,
        status: res.status,
        instanceNames,
        targetEmail,
        promote: payload,
        note:
          payload?.instanceOwners > 0
            ? "Transferência gravada. Se a UI não atualizar, reinicie o container Node no Easypanel."
            : "Nenhuma instância transferida (verifique dono atual ou forceInstanceOwnerTransfer no servidor).",
      },
      null,
      2,
    ),
  );
  if (!res.ok || !(payload?.instanceOwners > 0)) process.exit(1);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
