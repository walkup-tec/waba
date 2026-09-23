#!/usr/bin/env node
/**
 * Roda no PC onde o AdsPower está aberto.
 * Lê GET /api/v1/user/list e envia os perfis para a DRAX.
 *
 *   ADSPOWER_API_BASE=http://local.adspower.net:50325 \
 *   ADSPOWER_API_TOKEN=... \
 *   DRAX_BASE=https://waba.draxsistemas.com.br \
 *   ADSPOWER_INGEST_TOKEN=... \
 *   node scripts/adspower-sync-to-drax.mjs
 */
const adsBase = String(process.env.ADSPOWER_API_BASE || "http://local.adspower.net:50325").replace(
  /\/+$/,
  "",
);
const adsToken = String(process.env.ADSPOWER_API_TOKEN || "").trim();
const draxBase = String(process.env.DRAX_BASE || "https://waba.draxsistemas.com.br").replace(/\/+$/, "");
const ingestToken = String(process.env.ADSPOWER_INGEST_TOKEN || "").trim();

if (!ingestToken) {
  console.error("Defina ADSPOWER_INGEST_TOKEN.");
  process.exit(1);
}

const adsHeaders = { Accept: "application/json" };
if (adsToken) adsHeaders.Authorization = `Bearer ${adsToken}`;

const profiles = [];
for (let page = 1; page <= 50; page += 1) {
  const listUrl = `${adsBase}/api/v1/user/list?page=${page}&page_size=100`;
  const listRes = await fetch(listUrl, { headers: adsHeaders });
  const listJson = await listRes.json();
  if (Number(listJson.code) !== 0) {
    console.error("AdsPower Local API:", listJson.msg || listRes.status);
    process.exit(1);
  }
  const batch = Array.isArray(listJson.data?.list) ? listJson.data.list : [];
  profiles.push(...batch);
  if (batch.length < 100) break;
}
const ingestRes = await fetch(`${draxBase}/integrations/adspower/ingest`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${ingestToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ profiles, prune: true }),
});
const ingestJson = await ingestRes.json().catch(() => ({}));
if (!ingestRes.ok || ingestJson.ok === false) {
  console.error("DRAX ingest:", ingestJson.error || ingestRes.status);
  process.exit(1);
}
const pruned = Number(ingestJson.pruned || 0);
console.log(
  `Sincronizados ${ingestJson.upserted || profiles.length} perfil(is) AdsPower → DRAX.` +
    (pruned ? ` Removidos ${pruned} que não estão mais no AdsPower.` : ""),
);
