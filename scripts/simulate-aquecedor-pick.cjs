/**
 * Simula pickAquecedorCombinationAsync (src/index.ts) com dados reais do Supabase
 * para diagnosticar por que certos pares nunca são escolhidos no aquecedor.
 *
 * Uso: node scripts/simulate-aquecedor-pick.cjs [caminho-do-.env]
 */
const fs = require("fs");

const envPath = process.argv[2] || "D:/Waba/.env";
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const LOOKBACK = 500;

const connected = [
  { instancia: "walkup", numero: "555197462102" },
  { instancia: "1321-01", numero: "555181082477" },
  { instancia: "soma", numero: "555197979224" },
];

function normalizeWhatsAppNumber(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function resolveCanonical(name) {
  const found = connected.find(
    (c) => c.instancia.toLowerCase() === String(name || "").trim().toLowerCase(),
  );
  return found ? found.instancia : String(name || "").trim();
}

function resolveByNumber(rawNumber) {
  const normalized = normalizeWhatsAppNumber(rawNumber);
  if (!normalized) return "";
  for (const c of connected) {
    if (normalizeWhatsAppNumber(c.numero) === normalized) return c.instancia;
  }
  const suffix = normalized.slice(-10);
  if (suffix.length < 10) return "";
  for (const c of connected) {
    if (normalizeWhatsAppNumber(c.numero).slice(-10) === suffix) return c.instancia;
  }
  return "";
}

function pairKey(a, b) {
  return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}
function directedKey(o, d) {
  return `${o.trim().toLowerCase()}\u2192${d.trim().toLowerCase()}`;
}

async function supaGet(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function loadEvents() {
  const names = connected.map((c) => c.instancia);
  const events = [];
  const connectedCanonical = new Set(names.map((n) => n.toLowerCase()));

  const aq = await supaGet(
    `aquecedor?select=instancia,numero_destino,sent_at&status=eq.ENVIADO&instancia=in.(${names
      .map((n) => `"${n}"`)
      .join(",")})&order=sent_at.desc&limit=${LOOKBACK}`,
  );
  for (const row of aq) {
    const fromInst = resolveCanonical(row.instancia);
    const toInst = resolveByNumber(row.numero_destino);
    const at = String(row.sent_at || "").trim();
    if (
      fromInst && toInst && at &&
      connectedCanonical.has(fromInst.toLowerCase()) &&
      connectedCanonical.has(toInst.toLowerCase())
    ) {
      events.push({ at, fromInst, toInst });
    }
  }

  const logs = await supaGet(
    `logs_envios?select=instancia_origem,instancia_destino,data_envio&instancia_origem=in.(${names
      .map((n) => `"${n}"`)
      .join(",")})&instancia_destino=in.(${names
      .map((n) => `"${n}"`)
      .join(",")})&order=data_envio.desc&limit=${LOOKBACK}`,
  );
  for (const row of logs) {
    const fromInst = resolveCanonical(row.instancia_origem);
    const toInst = resolveCanonical(row.instancia_destino);
    const at = String(row.data_envio || "").trim();
    if (
      fromInst && toInst && at &&
      connectedCanonical.has(fromInst.toLowerCase()) &&
      connectedCanonical.has(toInst.toLowerCase())
    ) {
      events.push({ at, fromInst, toInst });
    }
  }

  const dedup = new Map();
  for (const ev of events) {
    const atMs = new Date(ev.at).getTime();
    const bucket = Number.isFinite(atMs) ? Math.floor(atMs / 1000) : ev.at;
    const key = `${ev.fromInst.toLowerCase()}|${ev.toInst.toLowerCase()}|${bucket}`;
    if (!dedup.has(key)) dedup.set(key, ev);
  }
  return Array.from(dedup.values()).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

const EQUITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAIR_TURN_STALE_MS = 6 * 60 * 60 * 1000;

function buildTurnManager(events) {
  const instanceStats = new Map();
  const pairLastSender = new Map();
  const pairStates = new Map();
  const directedSendCounts = new Map();
  const pairLastEventAtMs = new Map();
  const equityWindowStartMs = Date.now() - EQUITY_WINDOW_MS;
  const pairTurnStaleBeforeMs = Date.now() - PAIR_TURN_STALE_MS;

  const ensureStats = (canonical) => {
    const key = canonical.toLowerCase();
    let stats = instanceStats.get(key);
    if (!stats) {
      stats = {
        canonical,
        lastSentAt: null,
        lastReceivedAt: null,
        lastReceivedFrom: null,
        sendCount: 0,
        receiveCount: 0,
        outboundSinceInbound: 0,
      };
      instanceStats.set(key, stats);
    }
    return stats;
  };
  const ensurePairState = (key) => {
    let st = pairStates.get(key);
    if (!st) {
      st = { pendingReplyFrom: null, exchangeCount: 0 };
      pairStates.set(key, st);
    }
    return st;
  };

  for (const ev of events) {
    const evAtMs = new Date(ev.at).getTime();
    const withinEquityWindow = Number.isFinite(evAtMs) && evAtMs >= equityWindowStartMs;
    const fromStats = ensureStats(ev.fromInst);
    const toStats = ensureStats(ev.toInst);
    if (withinEquityWindow) {
      fromStats.sendCount += 1;
      toStats.receiveCount += 1;
      const dk = directedKey(ev.fromInst, ev.toInst);
      directedSendCounts.set(dk, (directedSendCounts.get(dk) || 0) + 1);
    }
    fromStats.lastSentAt = ev.at;
    toStats.lastReceivedAt = ev.at;
    toStats.lastReceivedFrom = ev.fromInst;
    fromStats.outboundSinceInbound += 1;
    toStats.outboundSinceInbound = 0;
    pairLastSender.set(pairKey(ev.fromInst, ev.toInst), ev.fromInst);

    const pk = pairKey(ev.fromInst, ev.toInst);
    if (Number.isFinite(evAtMs)) pairLastEventAtMs.set(pk, evAtMs);
    const ps = ensurePairState(pk);
    ps.exchangeCount += 1;
    if (ps.pendingReplyFrom?.toLowerCase() === ev.fromInst.toLowerCase()) {
      ps.pendingReplyFrom = null;
    } else {
      ps.pendingReplyFrom = ev.toInst;
    }
  }

  for (const [pk, lastAtMs] of pairLastEventAtMs) {
    if (lastAtMs >= pairTurnStaleBeforeMs) continue;
    pairLastSender.delete(pk);
    const ps = pairStates.get(pk);
    if (ps) ps.pendingReplyFrom = null;
  }
  for (const stats of instanceStats.values()) {
    const lastSentMs = stats.lastSentAt ? new Date(stats.lastSentAt).getTime() : NaN;
    if (Number.isFinite(lastSentMs) && lastSentMs < pairTurnStaleBeforeMs) {
      stats.outboundSinceInbound = 0;
    }
  }

  const recentDirectedEdges = [];
  for (let i = events.length - 1; i >= 0 && recentDirectedEdges.length < 32; i -= 1) {
    recentDirectedEdges.push(directedKey(events[i].fromInst, events[i].toInst));
  }

  const owesPairReply = (origem, destino) => {
    const ps = pairStates.get(pairKey(origem, destino));
    return ps?.pendingReplyFrom?.toLowerCase() === origem.toLowerCase();
  };
  const canSendDirected = (origem, destino) => {
    if (!origem || !destino || origem.toLowerCase() === destino.toLowerCase()) return false;
    const lastSender = pairLastSender.get(pairKey(origem, destino));
    if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) return false;
    if (owesPairReply(origem, destino)) return true;
    const stats = instanceStats.get(origem.toLowerCase());
    if (!stats?.lastSentAt || stats.outboundSinceInbound === 0) return true;
    return false;
  };
  const blockReason = (origem, destino) => {
    const lastSender = pairLastSender.get(pairKey(origem, destino));
    const stats = instanceStats.get(origem.toLowerCase());
    if (lastSender && lastSender.toLowerCase() === origem.toLowerCase()) {
      return `${origem} enviou por último no par; aguarda resposta de ${destino}`;
    }
    if (owesPairReply(origem, destino)) return "(deve responder — liberado)";
    if (stats && stats.outboundSinceInbound > 0) {
      return `${origem} tem ${stats.outboundSinceInbound} envio(s) sem inbound (último recebeu de ${stats.lastReceivedFrom || "?"})`;
    }
    return "livre";
  };

  const lastEvent = events.length ? events[events.length - 1] : null;
  const lastEventPairKey = lastEvent ? pairKey(lastEvent.fromInst, lastEvent.toInst) : null;

  return {
    instanceStats,
    pairLastSender,
    pairStates,
    directedSendCounts,
    recentDirectedEdges,
    lastEventPairKey,
    pairLastEventAtMs,
    equityWindowStartMs,
    owesPairReply,
    canSendDirected,
    blockReason,
    getDirectedSendCount: (o, d) => directedSendCounts.get(directedKey(o, d)) || 0,
    getOriginSendCount: (o) => instanceStats.get(o.toLowerCase())?.sendCount || 0,
    getDestReceiveCount: (d) => instanceStats.get(d.toLowerCase())?.receiveCount || 0,
    getUndirectedPairSendTotal: (a, b) =>
      (directedSendCounts.get(directedKey(a, b)) || 0) +
      (directedSendCounts.get(directedKey(b, a)) || 0),
    getTotalDirectedSendCount: () =>
      Array.from(directedSendCounts.values()).reduce((acc, v) => acc + v, 0),
  };
}

function pick(manager, combinations, startIndex) {
  let eligible = [];
  for (let index = 0; index < combinations.length; index += 1) {
    const combo = combinations[index];
    if (!manager.canSendDirected(combo.instancia_origem, combo.instancia_destino)) continue;
    eligible.push({ combo, index });
  }
  if (!eligible.length) return { chosen: null, eligible, scored: [] };

  const instanceCount = Math.max(2, connected.length);
  const maxShare = Math.max(0.5, 2 / instanceCount);
  const total = manager.getTotalDirectedSendCount();
  if (total >= instanceCount) {
    const nonSaturated = eligible.filter(
      ({ combo }) =>
        manager.getUndirectedPairSendTotal(combo.instancia_origem, combo.instancia_destino) /
          total <=
        maxShare,
    );
    if (nonSaturated.length) eligible = nonSaturated;
  }

  let minPairTotal = Infinity, minDirected = Infinity, minOrigin = Infinity, minDest = Infinity;
  for (const { combo } of eligible) {
    minPairTotal = Math.min(
      minPairTotal,
      manager.getUndirectedPairSendTotal(combo.instancia_origem, combo.instancia_destino),
    );
    minDirected = Math.min(
      minDirected,
      manager.getDirectedSendCount(combo.instancia_origem, combo.instancia_destino),
    );
    minOrigin = Math.min(minOrigin, manager.getOriginSendCount(combo.instancia_origem));
    minDest = Math.min(minDest, manager.getDestReceiveCount(combo.instancia_destino));
  }
  if (!Number.isFinite(minPairTotal)) minPairTotal = 0;
  if (!Number.isFinite(minDirected)) minDirected = 0;
  if (!Number.isFinite(minOrigin)) minOrigin = 0;
  if (!Number.isFinite(minDest)) minDest = 0;

  const scored = eligible.map(({ combo, index }) => {
    const directed = manager.getDirectedSendCount(combo.instancia_origem, combo.instancia_destino);
    const pairTotal = manager.getUndirectedPairSendTotal(combo.instancia_origem, combo.instancia_destino);
    const oSend = manager.getOriginSendCount(combo.instancia_origem);
    const dRecv = manager.getDestReceiveCount(combo.instancia_destino);
    let score = 0;
    const pk = pairKey(combo.instancia_origem, combo.instancia_destino);
    if (manager.lastEventPairKey && pk === manager.lastEventPairKey) {
      score += 1e18;
    }
    const pairLastAtMs = manager.pairLastEventAtMs.get(pk) ?? 0;
    const recencyMinutes = Math.max(0, (pairLastAtMs - manager.equityWindowStartMs) / 60000);
    score += recencyMinutes * 1e12;
    score += (pairTotal - minPairTotal) * 1e9;
    score += (directed - minDirected) * 1e6;
    score += (oSend - minOrigin) * 1e3;
    score += (dRecv - minDest) * 100;
    const recentIdx = manager.recentDirectedEdges.indexOf(
      directedKey(combo.instancia_origem, combo.instancia_destino),
    );
    if (recentIdx >= 0) score += (recentIdx + 1) * 10;
    if (manager.owesPairReply(combo.instancia_origem, combo.instancia_destino)) score -= 500;
    const rotation = (((index - startIndex) % 1000) + 1000) % 1000;
    score += rotation * 0.001;
    return { combo, index, score, pairTotal, directed, oSend, dRecv };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0].score;
  const ties = scored.filter((s) => s.score === best);
  const base = ((startIndex % ties.length) + ties.length) % ties.length;
  return { chosen: ties[base], eligible, scored };
}

(async () => {
  const events = await loadEvents();
  console.log(`Eventos no lookback: ${events.length}`);
  console.log(`Primeiro: ${events[0]?.at}  Último: ${events[events.length - 1]?.at}`);

  const manager = buildTurnManager(events);

  console.log("\n--- Stats por instância ---");
  for (const [, s] of manager.instanceStats) {
    console.log(
      `${s.canonical.padEnd(10)} send=${String(s.sendCount).padStart(3)} recv=${String(s.receiveCount).padStart(3)} outboundSinceInbound=${s.outboundSinceInbound} lastReceivedFrom=${s.lastReceivedFrom}`,
    );
  }

  console.log("\n--- Pares (lastSender / pendingReplyFrom) ---");
  for (const [key, st] of manager.pairStates) {
    console.log(
      `${key.padEnd(20)} lastSender=${manager.pairLastSender.get(key)} pendingReplyFrom=${st.pendingReplyFrom} exchanges=${st.exchangeCount}`,
    );
  }

  const combos = [];
  for (const o of connected) {
    for (const d of connected) {
      if (o.instancia === d.instancia) continue;
      combos.push({ instancia_origem: o.instancia, instancia_destino: d.instancia });
    }
  }

  console.log("\n--- Elegibilidade por combinação ---");
  for (const c of combos) {
    const ok = manager.canSendDirected(c.instancia_origem, c.instancia_destino);
    console.log(
      `${(c.instancia_origem + " -> " + c.instancia_destino).padEnd(22)} elegível=${ok ? "SIM" : "NÃO"} directed=${manager.getDirectedSendCount(c.instancia_origem, c.instancia_destino)} | ${manager.blockReason(c.instancia_origem, c.instancia_destino)}`,
    );
  }

  const result = pick(manager, combos, 0);
  console.log("\n--- Scores (ordenados) ---");
  console.log(`(último par que trocou: ${manager.lastEventPairKey})`);
  for (const s of result.scored) {
    console.log(
      `${(s.combo.instancia_origem + " -> " + s.combo.instancia_destino).padEnd(22)} score=${s.score.toExponential(3)} pairTotal=${s.pairTotal} directed=${s.directed} originSend=${s.oSend} destRecv=${s.dRecv}`,
    );
  }
  console.log(
    "\nESCOLHIDO:",
    result.chosen
      ? `${result.chosen.combo.instancia_origem} -> ${result.chosen.combo.instancia_destino}`
      : "nenhum",
  );

  // Projeção: simula os próximos 12 envios aplicando o mesmo algoritmo
  console.log("\n--- Projeção dos próximos 12 envios ---");
  const futureEvents = [...events];
  for (let step = 0; step < 12; step += 1) {
    const mgr = buildTurnManager(futureEvents);
    const res = pick(mgr, combos, step);
    if (!res.chosen) {
      console.log(`${String(step + 1).padStart(2)}. nenhum par elegível`);
      break;
    }
    const { instancia_origem: o, instancia_destino: d } = res.chosen.combo;
    console.log(`${String(step + 1).padStart(2)}. ${o} -> ${d}`);
    futureEvents.push({ at: new Date(Date.now() + step * 1000).toISOString(), fromInst: o, toInst: d });
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
