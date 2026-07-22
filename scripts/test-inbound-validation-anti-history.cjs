/**
 * Teste offline: histórico real EVO da instância 1261 NÃO pode passar no filtro anti-histórico.
 * Uso: node scripts/test-inbound-validation-anti-history.mjs
 */
const fs = require("fs");
const path = require("path");

const dumpPath =
  process.argv[2] ||
  path.join("E:", "01A-Drax-Servidor", "Waba", ".tmp-evo", "find-all-out.json");

function extractTs(msg) {
  const n = Number(msg.messageTimestamp);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

function normalizeKeyword(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function isConfirm(msg) {
  const t =
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    "";
  const n = normalizeKeyword(t);
  return n === "confirmar" || n === "confirma" || n.includes("confirmar") || n.includes("confirma");
}

function isInbound(msg) {
  return msg?.key?.fromMe !== true;
}

const raw = fs.readFileSync(dumpPath, "utf8");
const json = JSON.parse(raw);
const records = json?.messages?.records || json?.records || [];
const confirms = records.filter((m) => isInbound(m) && isConfirm(m));
const replies = records.filter((m) => {
  const t =
    m?.message?.conversation || m?.message?.extendedTextMessage?.text || "";
  return /validação waba|waba-val/i.test(t);
});

const highWater = Math.max(
  0,
  ...confirms.map((m) => extractTs(m) || 0),
);
const validationStartedAtMs = Date.now();
const clockSkew = 2000;
const minTs = Math.max(validationStartedAtMs - clockSkew, highWater + 1);

const falseReceive = confirms.filter((m) => {
  const ts = extractTs(m);
  return ts != null && ts >= minTs;
});

const newMarker = "WABA-VAL:deadbeef";
const falseReplyGeneric = replies.filter((m) => {
  const t = String(
    m?.message?.conversation || m?.message?.extendedTextMessage?.text || "",
  ).toLowerCase();
  return t.includes("validação waba concluída");
});
const falseReplyStrict = replies.filter((m) => {
  const t = String(
    m?.message?.conversation || m?.message?.extendedTextMessage?.text || "",
  ).toLowerCase();
  return t.includes(newMarker.toLowerCase());
});

console.log(
  JSON.stringify(
    {
      dumpPath,
      confirmCount: confirms.length,
      replyCount: replies.length,
      highWaterIso: highWater ? new Date(highWater).toISOString() : null,
      minAcceptIso: new Date(minTs).toISOString(),
      falseReceiveWouldPass: falseReceive.length,
      oldGenericReplyWouldPassLegacy: falseReplyGeneric.length,
      oldReplyWouldPassStrictMarker: falseReplyStrict.length,
      ok:
        falseReceive.length === 0 &&
        falseReplyStrict.length === 0 &&
        confirms.length > 0,
    },
    null,
    2,
  ),
);

if (falseReceive.length !== 0 || falseReplyStrict.length !== 0 || confirms.length === 0) {
  process.exit(1);
}
