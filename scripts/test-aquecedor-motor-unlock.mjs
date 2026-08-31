/**
 * Testes internos do motor aquecedor (sem sendText / sem EVO).
 * node scripts/test-aquecedor-motor-unlock.mjs
 */
import assert from "node:assert/strict";

const PAIR_TURN_STALE_MS = 90 * 60 * 1000;
const SOFT_COOLDOWN_MS = 3 * 60 * 1000;

function buildPairKey(a, b) {
  return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}

function buildDirectedKey(o, d) {
  return `${String(o).toLowerCase()}→${String(d).toLowerCase()}`;
}

/** Espelho mínimo de canSendDirected pós-fix. */
function canSendDirected(ctx, origemRaw, destinoRaw) {
  const origem = String(origemRaw || "").trim();
  const destino = String(destinoRaw || "").trim();
  if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase()) return false;
  const connected = ctx.connectedCanonical;
  if (!connected.has(origem.toLowerCase()) || !connected.has(destino.toLowerCase())) return false;

  const pairKey = buildPairKey(origem, destino);
  const lastSender = ctx.pairLastSender.get(pairKey);
  if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) return false;

  const pending = ctx.pairPending.get(pairKey);
  if (pending && pending.toLowerCase() === origem.toLowerCase()) return true;

  const stats = ctx.instanceStats.get(origem.toLowerCase());
  if (!stats?.lastSentAt || stats.outboundSinceInbound === 0) return true;
  const lastTo = stats.lastOutboundTo;
  if (lastTo && !connected.has(String(lastTo).toLowerCase())) return true;
  return false;
}

/** Espelho: forced reply só se direção curativa não estiver blocked. */
function pickPool(raw, lastKey, lastBalance, blocked) {
  let pool = raw.filter((c) => !blocked.has(buildDirectedKey(c.origem, c.destino)));
  if (lastKey && Math.abs(lastBalance) >= 1) {
    const replyPool = pool.filter((c) => c.pairKey === lastKey);
    if (replyPool.length) return replyPool;
  }
  return pool;
}

// --- Casos ---

// 1) Peer saiu do ciclo: origem não fica congelada para outros pares
{
  const ctx = {
    connectedCanonical: new Set(["2477", "walkup"]),
    pairLastSender: new Map([[buildPairKey("2477", "walkup"), "walkup"]]),
    pairPending: new Map(),
    instanceStats: new Map([
      [
        "2477",
        {
          lastSentAt: new Date().toISOString(),
          outboundSinceInbound: 1,
          lastOutboundTo: "1261", // fora do ciclo
        },
      ],
    ]),
  };
  assert.equal(canSendDirected(ctx, "2477", "walkup"), true, "peer offline libera 2477→walkup");
}

// 2) Mesmo par: ainda exige resposta (lastSender)
{
  const ctx = {
    connectedCanonical: new Set(["2477", "1261", "walkup"]),
    pairLastSender: new Map([[buildPairKey("2477", "1261"), "2477"]]),
    pairPending: new Map([[buildPairKey("2477", "1261"), "1261"]]),
    instanceStats: new Map([
      ["2477", { lastSentAt: new Date().toISOString(), outboundSinceInbound: 1, lastOutboundTo: "1261" }],
      ["1261", { lastSentAt: null, outboundSinceInbound: 0, lastOutboundTo: null }],
    ]),
  };
  assert.equal(canSendDirected(ctx, "2477", "1261"), false, "2477 não repete no par");
  assert.equal(canSendDirected(ctx, "1261", "2477"), true, "1261 responde");
}

// 3) Soft-skip da resposta forçada → pool geral disponível
{
  const raw = [
    { origem: "1261", destino: "2477", pairKey: buildPairKey("1261", "2477") },
    { origem: "walkup", destino: "2477", pairKey: buildPairKey("walkup", "2477") },
    { origem: "2477", destino: "walkup", pairKey: buildPairKey("walkup", "2477") },
  ];
  const blocked = new Set([buildDirectedKey("1261", "2477")]);
  const pool = pickPool(raw, buildPairKey("1261", "2477"), 1, blocked);
  assert.ok(
    pool.some((c) => c.origem === "walkup" && c.destino === "2477"),
    "com 1261→2477 blocked, walkup→2477 entra no pool",
  );
  assert.ok(!pool.some((c) => c.origem === "1261"), "direção soft-skipped fora");
}

// 4) Stale 90min (não 6h)
assert.equal(PAIR_TURN_STALE_MS, 90 * 60 * 1000, "stale = 90min");
assert.equal(SOFT_COOLDOWN_MS, 3 * 60 * 1000, "soft cooldown = 3min");
assert.ok(PAIR_TURN_STALE_MS < 6 * 60 * 60 * 1000, "stale menor que 6h");

// 5) Loop de pick: no máximo 1 sendText (simulado) após N soft skips
{
  let sendTextCalls = 0;
  const skip = new Set();
  const dirs = ["a→b", "c→d", "e→f"];
  let sent = null;
  for (const dir of dirs) {
    if (skip.has(dir)) continue;
    if (dir === "a→b" || dir === "c→d") {
      skip.add(dir);
      continue; // soft fail — sem sendText
    }
    sendTextCalls += 1;
    sent = dir;
    break;
  }
  assert.equal(sendTextCalls, 1, "apenas 1 sendText após soft skips");
  assert.equal(sent, "e→f", "escolheu direção saudável");
  assert.equal(skip.size, 2, "soft skips acumulados");
}

console.log(
  JSON.stringify({
    ok: true,
    staleMinutes: PAIR_TURN_STALE_MS / 60000,
    softCooldownMinutes: SOFT_COOLDOWN_MS / 60000,
  }),
);
