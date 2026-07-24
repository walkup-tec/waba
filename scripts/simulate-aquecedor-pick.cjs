/**
 * Simula RelationshipManager (saldo + volume entre pares + anti-repetição).
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
const MAX_BALANCE_ABS = 2;

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
      fromInst &&
      toInst &&
      at &&
      connectedCanonical.has(fromInst.toLowerCase()) &&
      connectedCanonical.has(toInst.toLowerCase())
    ) {
      events.push({ at, fromInst, toInst });
    }
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return events;
}

function emptyPair(a, b) {
  return {
    a,
    b,
    sentAB: 0,
    sentBA: 0,
    balance: 0,
    lastMessageAt: null,
    lastDirection: null,
    totalMessages: 0,
    usageToday: 0,
  };
}

function buildGraph(events) {
  const pairs = new Map();
  const phones = new Map();
  const ensurePhone = (name) => {
    if (!phones.has(name)) phones.set(name, { sent: 0, received: 0 });
    return phones.get(name);
  };
  for (const c of connected) {
    ensurePhone(c.instancia);
    for (const d of connected) {
      if (c.instancia === d.instancia) continue;
      const key = pairKey(c.instancia, d.instancia);
      if (!pairs.has(key)) {
        const [a, b] = key.split("|");
        pairs.set(key, emptyPair(a, b));
      }
    }
  }
  let lastSelectedPairKey = null;
  for (const ev of events) {
    const key = pairKey(ev.fromInst, ev.toInst);
    let pair = pairs.get(key);
    if (!pair) {
      const [a, b] = key.split("|");
      pair = emptyPair(a, b);
      pairs.set(key, pair);
    }
    const direction =
      ev.fromInst.localeCompare(pair.a) === 0 && ev.toInst.localeCompare(pair.b) === 0
        ? "a_to_b"
        : "b_to_a";
    if (direction === "a_to_b") pair.sentAB += 1;
    else pair.sentBA += 1;
    pair.lastDirection = direction;
    pair.lastMessageAt = ev.at;
    pair.usageToday += 1;
    pair.balance = pair.sentAB - pair.sentBA;
    pair.totalMessages = pair.sentAB + pair.sentBA;
    ensurePhone(ev.fromInst).sent += 1;
    ensurePhone(ev.toInst).received += 1;
    lastSelectedPairKey = key;
  }
  return { pairs, phones, lastSelectedPairKey };
}

function directionAllowed(pair, origem, destino) {
  const direction =
    origem.localeCompare(pair.a) === 0 && destino.localeCompare(pair.b) === 0
      ? "a_to_b"
      : "b_to_a";
  if (pair.lastDirection === direction && pair.totalMessages > 0) {
    return { ok: false, reason: "mesmo sentido consecutivo" };
  }
  const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
  if (Math.abs(nextBalance) > MAX_BALANCE_ABS) {
    return { ok: false, reason: `|saldo|>${MAX_BALANCE_ABS}` };
  }
  if (Math.abs(pair.balance) >= 1 && Math.abs(nextBalance) >= Math.abs(pair.balance)) {
    return { ok: false, reason: "não reduz desequilíbrio" };
  }
  return { ok: true, direction, nextBalance };
}

function avgPairTotal(graph) {
  const vals = [...graph.pairs.values()].map((p) => p.totalMessages);
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function pick(graph, startIndex) {
  const names = connected.map((c) => c.instancia);
  let raw = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const key = pairKey(names[i], names[j]);
      const pair = graph.pairs.get(key);
      if (!pair) continue;
      for (const [origem, destino] of [
        [pair.a, pair.b],
        [pair.b, pair.a],
      ]) {
        const gate = directionAllowed(pair, origem, destino);
        if (!gate.ok) continue;
        raw.push({ origem, destino, pair, pairKey: key, nextBalance: gate.nextBalance });
      }
    }
  }
  const prefer = raw.filter((c) => Math.abs(c.nextBalance) <= 1);
  let pool = prefer.length ? prefer : raw;
  if (graph.lastSelectedPairKey && pool.length > 1) {
    const without = pool.filter((c) => c.pairKey !== graph.lastSelectedPairKey);
    if (without.length) pool = without;
  }
  if (!pool.length) return { chosen: null, scored: [] };

  const avgSent =
    names.reduce((s, n) => s + (graph.phones.get(n)?.sent || 0), 0) / names.length;
  const avgRecv =
    names.reduce((s, n) => s + (graph.phones.get(n)?.received || 0), 0) / names.length;
  const avgTotal = avgPairTotal(graph);

  const scored = pool.map((c) => {
    const absBalance = Math.abs(c.pair.balance);
    const total = c.pair.totalMessages || 0;
    const volumeDeficit = Math.max(0, avgTotal - total);
    let repetitionPenalty = 0;
    if (graph.lastSelectedPairKey === c.pairKey) repetitionPenalty += 5e9;
    repetitionPenalty += (c.pair.usageToday || 0) * 200000;
    const coverageScore = total === 0 ? 2e6 : Math.max(0, 8 - total) * 80000;
    const originSent = graph.phones.get(c.origem)?.sent || 0;
    const destRecv = graph.phones.get(c.destino)?.received || 0;
    const lastAt = c.pair.lastMessageAt ? Date.parse(c.pair.lastMessageAt) : 0;
    const minutes = lastAt ? Math.max(0, (Date.now() - lastAt) / 60000) : 1e6;
    const score =
      absBalance * 1e6 +
      volumeDeficit * 50000 +
      coverageScore +
      (avgSent - originSent) * 1000 +
      (avgRecv - destRecv) * 100 +
      Math.min(minutes, 10000) -
      repetitionPenalty;
    return { ...c, score, absBalance, volumeDeficit };
  });
  scored.sort((a, b) => b.score - a.score || a.pairKey.localeCompare(b.pairKey));
  const best = scored[0].score;
  const ties = scored.filter((s) => s.score === best);
  const base = ((startIndex % ties.length) + ties.length) % ties.length;
  return { chosen: ties[base], scored };
}

function applySend(graph, origem, destino, at) {
  const key = pairKey(origem, destino);
  let pair = graph.pairs.get(key);
  if (!pair) {
    const [a, b] = key.split("|");
    pair = emptyPair(a, b);
    graph.pairs.set(key, pair);
  }
  const direction =
    origem.localeCompare(pair.a) === 0 && destino.localeCompare(pair.b) === 0
      ? "a_to_b"
      : "b_to_a";
  if (direction === "a_to_b") pair.sentAB += 1;
  else pair.sentBA += 1;
  pair.lastDirection = direction;
  pair.lastMessageAt = at;
  pair.usageToday += 1;
  pair.balance = pair.sentAB - pair.sentBA;
  pair.totalMessages = pair.sentAB + pair.sentBA;
  if (!graph.phones.has(origem)) graph.phones.set(origem, { sent: 0, received: 0 });
  if (!graph.phones.has(destino)) graph.phones.set(destino, { sent: 0, received: 0 });
  graph.phones.get(origem).sent += 1;
  graph.phones.get(destino).received += 1;
  graph.lastSelectedPairKey = key;
}

(async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no .env");
  }
  const events = await loadEvents();
  console.log(`Eventos no lookback: ${events.length}`);
  const graph = buildGraph(events);

  console.log("\n--- Pares (total / saldo) ---");
  for (const [key, p] of graph.pairs) {
    console.log(
      `${key.padEnd(22)} total=${String(p.totalMessages).padStart(3)} saldo=${String(p.balance).padStart(3)} last=${p.lastDirection}`,
    );
  }

  const result = pick(graph, 0);
  console.log("\n--- Top scores ---");
  for (const s of result.scored.slice(0, 10)) {
    console.log(
      `${(s.origem + " -> " + s.destino).padEnd(22)} score=${s.score.toFixed(0)} total=${s.pair.totalMessages} deficit=${s.volumeDeficit.toFixed(1)}`,
    );
  }
  console.log(
    "\nESCOLHIDO:",
    result.chosen ? `${result.chosen.origem} -> ${result.chosen.destino}` : "nenhum",
  );

  console.log("\n--- Projeção 12 envios (rotatividade de pares) ---");
  const future = buildGraph(events);
  for (let step = 0; step < 12; step += 1) {
    const res = pick(future, step);
    if (!res.chosen) {
      console.log(`${String(step + 1).padStart(2)}. nenhum`);
      break;
    }
    const { origem: o, destino: d, pairKey: pk } = res.chosen;
    console.log(`${String(step + 1).padStart(2)}. ${o} -> ${d}  [${pk}]`);
    applySend(future, o, d, new Date(Date.now() + step * 1000).toISOString());
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
