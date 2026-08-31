/**
 * Transfere instância por número via API admin em produção (master).
 *
 * Uso:
 *   node scripts/transfer-instance-owner-prod.cjs 51982006019 walkup@walkuptec.com.br
 *   node scripts/transfer-instance-owner-prod.cjs 5182006019 walkup@walkuptec.com.br --lookup-only
 */
const dotenv = require("dotenv");
const path = require("node:path");

dotenv.config({ path: path.join(__dirname, "..", ".env.v02") });
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: false });

const phone = String(process.argv[2] || "").trim();
const targetEmail = String(process.argv[3] || "walkup@walkuptec.com.br").trim().toLowerCase();
const lookupOnly = process.argv.includes("--lookup-only");
const prodBase = String(process.env.WABA_PROD_BASE_URL || "https://waba.draxsistemas.com.br").replace(
  /\/+$/,
  "",
);
const loginEmail = String(process.env.WABA_ADMIN_EMAIL || "walkup@walkuptec.com.br").trim();
const loginPassword = String(process.env.WABA_ADMIN_PASSWORD || "").trim();

if (!phone || !targetEmail.includes("@")) {
  console.error(
    "Uso: node scripts/transfer-instance-owner-prod.cjs <numero> [email-destino] [--lookup-only]",
  );
  process.exit(1);
}

if (!loginPassword) {
  console.error("Defina WABA_ADMIN_PASSWORD em .env.v02");
  process.exit(1);
}

async function login() {
  const res = await fetch(`${prodBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  if (!res.ok) {
    throw new Error(`Login falhou (${res.status})`);
  }
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Cookie de sessão não recebido.");
  return cookie;
}

async function main() {
  const cookie = await login();
  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const lookupRes = await fetch(
    `${prodBase}/admin/instances/lookup?phone=${encodeURIComponent(phone)}`,
    { headers: { Cookie: cookie } },
  );
  const lookupPayload = await lookupRes.json().catch(() => ({}));
  if (!lookupRes.ok) {
    console.log(JSON.stringify({ step: "lookup", ok: false, status: lookupRes.status, lookupPayload }, null, 2));
    if (lookupRes.status === 404) {
      console.error("Endpoint ainda não publicado. Aguarde deploy e tente novamente.");
    }
    process.exit(1);
  }

  console.log(JSON.stringify({ step: "lookup", ok: true, items: lookupPayload.items || [] }, null, 2));
  if (lookupOnly) return;

  const transferRes = await fetch(`${prodBase}/admin/instances/transfer-owner`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, targetEmail }),
  });
  const transferPayload = await transferRes.json().catch(() => ({}));
  console.log(
    JSON.stringify(
      { step: "transfer", ok: transferRes.ok, status: transferRes.status, ...transferPayload },
      null,
      2,
    ),
  );
  if (!transferRes.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
