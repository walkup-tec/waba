"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECTION_HISTORY_LIMIT = void 0;
exports.scoreRelationshipCandidate = scoreRelationshipCandidate;
exports.pickNextRelationship = pickNextRelationship;
exports.buildSelectionRecord = buildSelectionRecord;
exports.explainDirectedBlock = explainDirectedBlock;
const conversation_graph_service_1 = require("./conversation-graph.service");
const SELECTION_HISTORY_LIMIT = 40;
exports.SELECTION_HISTORY_LIMIT = SELECTION_HISTORY_LIMIT;
function phoneSentToday(owner, name) {
    const key = String(name || "").trim();
    const stats = owner.phones[key];
    if (!stats)
        return 0;
    if (stats.dayKey !== (0, conversation_graph_service_1.dayKeySaoPaulo)())
        return 0;
    return stats.sentToday || 0;
}
function phoneReceivedToday(owner, name) {
    const key = String(name || "").trim();
    const stats = owner.phones[key];
    if (!stats)
        return 0;
    if (stats.dayKey !== (0, conversation_graph_service_1.dayKeySaoPaulo)())
        return 0;
    return stats.receivedToday || 0;
}
/** Volume vitalício do número (enviadas + recebidas) — base da justiça na UI. */
function phoneLifetimeTotal(owner, name) {
    const key = String(name || "").trim();
    const stats = owner.phones[key];
    if (!stats)
        return 0;
    return Math.max(0, (stats.sentTotal || 0) + (stats.receivedTotal || 0));
}
function pairUsageToday(pair) {
    const today = (0, conversation_graph_service_1.dayKeySaoPaulo)();
    if (pair.dayKey !== today)
        return 0;
    return pair.usageToday || 0;
}
function minutesSinceLastPair(pairLastAt) {
    if (!pairLastAt)
        return 1e6;
    const at = Date.parse(pairLastAt);
    if (!Number.isFinite(at))
        return 1e6;
    return Math.max(0, (Date.now() - at) / 60000);
}
function avgPairTotal(owner, names) {
    const keys = new Set();
    for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
            keys.add((0, conversation_graph_service_1.buildConversationPairKey)(names[i], names[j]));
        }
    }
    if (!keys.size)
        return 0;
    let sum = 0;
    for (const key of keys) {
        sum += owner.pairs[key]?.totalMessages || 0;
    }
    return sum / keys.size;
}
/**
 * RelationshipManager — score multi-objetivo para escolher o próximo relacionamento.
 *
 * Maior score = melhor. Nunca aleatório.
 */
function scoreRelationshipCandidate(owner, origem, destino, pair, pairKey, ctx) {
    const absBalance = Math.abs(pair.balance);
    const total = pair.totalMessages || 0;
    const usageToday = pairUsageToday(pair);
    const originSent = phoneSentToday(owner, origem);
    const destRecv = phoneReceivedToday(owner, destino);
    const originLifetime = phoneLifetimeTotal(owner, origem);
    const destLifetime = phoneLifetimeTotal(owner, destino);
    const minutesIdle = minutesSinceLastPair(pair.lastMessageAt);
    // 1) Desequilíbrio de sentido — prioridade alta, mas não absoluta sobre cobertura.
    const balanceScore = absBalance * 1000000;
    // 2) Volume do relacionamento vs média da rede — pares atrasados sobem.
    const volumeDeficit = Math.max(0, ctx.avgPairTotal - total);
    const volumeScore = volumeDeficit * 50000;
    // 3) Penalização por repetição do mesmo relacionamento — EXCETO resposta do turno.
    // balance = sentAB - sentBA: se >0, falta B→A; se <0, falta A→B.
    const isBalancingReply = (pair.balance > 0 && origem === pair.b && destino === pair.a) ||
        (pair.balance < 0 && origem === pair.a && destino === pair.b);
    const bothPhonesHot = ctx.avgPhoneTotal > 5 &&
        originLifetime > ctx.avgPhoneTotal * 1.25 &&
        destLifetime > ctx.avgPhoneTotal * 1.25;
    let repetitionPenalty = 0;
    if (ctx.lastSelectedPairKey && ctx.lastSelectedPairKey === pairKey && !isBalancingReply) {
        repetitionPenalty = 5000000000; // hard demote — quase nunca escolhe o mesmo par em seguida
    }
    // Penalização crescente por uso recente no dia (resposta do turno não conta como "spam").
    if (!isBalancingReply) {
        repetitionPenalty += usageToday * 200000;
        if (minutesIdle < 15) {
            repetitionPenalty += (15 - minutesIdle) * 80000;
        }
    }
    else if (bothPhonesHot && ctx.hasColdPhones) {
        // Não deixar ping-pong de par quente monopolizar enquanto há números frios.
        repetitionPenalty -= 400000;
    }
    else {
        // Resposta pendente: prioridade alta para completar A→B / B→A.
        repetitionPenalty -= 8000000000;
    }
    // 4) Cobertura: par sem histórico sobe fortemente.
    const coverageScore = total === 0 ? 2000000 : Math.max(0, 8 - total) * 80000;
    // 5) Participação: dia + vitalício (o que a UI de Mensagens mostra).
    const dailyParticipation = (ctx.avgSentToday - originSent) * 1000 + (ctx.avgRecvToday - destRecv) * 100;
    const lifetimeFairness = (ctx.avgPhoneTotal - originLifetime) * 90000 +
        (ctx.avgPhoneTotal - destLifetime) * 90000;
    const overheatPenalty = ctx.avgPhoneTotal > 5 && originLifetime > ctx.avgPhoneTotal * 1.4
        ? (originLifetime - ctx.avgPhoneTotal) * 150000
        : 0;
    const participationScore = dailyParticipation + lifetimeFairness - overheatPenalty;
    // 6) Histórico LRU leve (desempate).
    const historyScore = Math.min(minutesIdle, 10000);
    const totalScore = balanceScore +
        volumeScore +
        coverageScore +
        participationScore +
        historyScore -
        repetitionPenalty;
    const breakdown = {
        balanceScore,
        volumeScore,
        repetitionPenalty,
        coverageScore,
        participationScore,
        historyScore,
        total: totalScore,
    };
    const reasons = [];
    if (absBalance >= 1)
        reasons.push(`saldo=${pair.balance > 0 ? "+" : ""}${pair.balance}`);
    if (volumeDeficit > 0.5)
        reasons.push(`volume atrasado (−${volumeDeficit.toFixed(0)} vs média)`);
    if (total === 0)
        reasons.push("cobertura (par novo)");
    if (isBalancingReply) {
        reasons.push(bothPhonesHot && ctx.hasColdPhones
            ? "resposta adiada (par quente; há números frios)"
            : "resposta do turno (A→B / B→A)");
    }
    else if (ctx.lastSelectedPairKey === pairKey)
        reasons.push("penalidade: mesmo par anterior");
    if (lifetimeFairness > 50000)
        reasons.push("justiça vitalícia (números abaixo da média)");
    if (overheatPenalty > 0)
        reasons.push("penalidade: origem acima da média");
    if (usageToday > 0 && !isBalancingReply)
        reasons.push(`uso hoje=${usageToday}`);
    if (!reasons.length)
        reasons.push("rede equilibrada — LRU/participação");
    return {
        score: totalScore,
        reason: reasons.join("; "),
        breakdown,
    };
}
/**
 * Lista todos os pares possíveis, aplica filtros duros de direção/saldo,
 * pontua e escolhe o melhor (nunca aleatório).
 */
function pickNextRelationship(owner, eligibleInstanceNames, options = {}) {
    const names = eligibleInstanceNames.map((n) => String(n || "").trim()).filter(Boolean);
    if (names.length < 2)
        return null;
    const blocked = options.blockedDirectedKeys;
    const rawAll = (0, conversation_graph_service_1.listDirectedCandidatesForInstances)(owner, names);
    const raw = blocked?.size
        ? rawAll.filter(({ origem, destino }) => !blocked.has(`${origem.toLowerCase()}→${destino.toLowerCase()}`))
        : rawAll;
    const reducesToOneOrLess = raw.filter(({ origem, destino, pair }) => {
        const direction = origem.localeCompare(pair.a) === 0 && destino.localeCompare(pair.b) === 0
            ? "a_to_b"
            : "b_to_a";
        const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
        return Math.abs(nextBalance) <= 1;
    });
    let pool = reducesToOneOrLess.length ? reducesToOneOrLess : raw;
    const lifetimeValues = names.map((n) => phoneLifetimeTotal(owner, n));
    const avgPhoneTotal = lifetimeValues.reduce((s, v) => s + v, 0) / Math.max(1, lifetimeValues.length);
    const phoneMax = lifetimeValues.length ? Math.max(...lifetimeValues) : 0;
    const phoneMin = lifetimeValues.length ? Math.min(...lifetimeValues) : 0;
    const phoneSpread = phoneMax - phoneMin;
    const coldThreshold = Math.max(0, avgPhoneTotal * 0.7);
    const coldPhones = new Set(names.filter((n) => phoneLifetimeTotal(owner, n) <= coldThreshold));
    const hasColdPhones = coldPhones.size > 0 && phoneSpread >= Math.max(6, avgPhoneTotal * 0.4);
    // Completar conversa: se o último par está desequilibrado, a resposta do turno
    // (B→A após A→B) tem prioridade — não excluir o par "para evitar ping-pong".
    // Se a resposta exige instância fora do ciclo (ex.: 8927 close), não forçar o par:
    // seguir com o pool geral para não travar o motor.
    // Se a direção curativa está em cooldown/soft-skip (blocked), também NÃO forçar —
    // senão o motor fica em loop eterno no mesmo A→B morto.
    // Se o par anterior é entre dois números quentes e há números frios, NÃO forçar —
    // senão o ping-pong impede equalizar a coluna Mensagens.
    const lastKey = owner.lastSelectedPairKey || null;
    const lastPair = lastKey ? owner.pairs[lastKey] : null;
    if (lastPair && Math.abs(lastPair.balance) >= 1) {
        const replyPool = raw.filter(({ origem, destino, pair, pairKey }) => {
            if (pairKey !== lastKey)
                return false;
            const direction = origem.localeCompare(pair.a) === 0 && destino.localeCompare(pair.b) === 0
                ? "a_to_b"
                : "b_to_a";
            const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
            return Math.abs(nextBalance) < Math.abs(pair.balance);
        });
        const replyTouchesCold = replyPool.some(({ origem, destino }) => coldPhones.has(origem) || coldPhones.has(destino));
        const replyBothHot = hasColdPhones &&
            phoneLifetimeTotal(owner, lastPair.a) > avgPhoneTotal * 1.25 &&
            phoneLifetimeTotal(owner, lastPair.b) > avgPhoneTotal * 1.25;
        if (replyPool.length && (!replyBothHot || replyTouchesCold)) {
            pool = replyPool;
        }
    }
    else if (lastKey && pool.length > 1) {
        const withoutLast = pool.filter((c) => c.pairKey !== lastKey);
        if (withoutLast.length)
            pool = withoutLast;
    }
    // Soft filter: com spread alto, priorizar candidatos que tocam número abaixo da média.
    if (hasColdPhones && pool.length > 1) {
        const withCold = pool.filter(({ origem, destino }) => coldPhones.has(origem) || coldPhones.has(destino));
        if (withCold.length)
            pool = withCold;
    }
    if (!pool.length)
        return null;
    const sentValues = names.map((n) => phoneSentToday(owner, n));
    const recvValues = names.map((n) => phoneReceivedToday(owner, n));
    const avgSentToday = sentValues.reduce((s, v) => s + v, 0) / Math.max(1, sentValues.length);
    const avgRecvToday = recvValues.reduce((s, v) => s + v, 0) / Math.max(1, recvValues.length);
    const avgTotal = avgPairTotal(owner, names);
    const ctx = {
        avgSentToday,
        avgRecvToday,
        avgPairTotal: avgTotal,
        avgPhoneTotal,
        phoneSpread,
        hasColdPhones,
        lastSelectedPairKey: lastKey,
    };
    const scored = pool.map(({ origem, destino, pair, pairKey }) => {
        const { score, reason, breakdown } = scoreRelationshipCandidate(owner, origem, destino, pair, pairKey, ctx);
        return {
            origem,
            destino,
            pairKey,
            balance: pair.balance,
            absBalance: Math.abs(pair.balance),
            score,
            reason,
            breakdown,
        };
    });
    scored.sort((a, b) => b.score - a.score || a.pairKey.localeCompare(b.pairKey));
    const bestScore = scored[0].score;
    const ties = scored.filter((item) => item.score === bestScore);
    const startIndex = Number(options.startIndex) || 0;
    const base = ((startIndex % ties.length) + ties.length) % ties.length;
    const picked = ties[base];
    return {
        origem: picked.origem,
        destino: picked.destino,
        pairKey: picked.pairKey,
        score: picked.score,
        balance: picked.balance,
        reason: picked.reason,
        breakdown: picked.breakdown,
        candidatesEvaluated: raw.length,
        candidatesEligible: pool.length,
        ranked: scored.slice(0, 15),
    };
}
function buildSelectionRecord(pick, atIso) {
    return {
        at: atIso || new Date().toISOString(),
        pairKey: pick.pairKey,
        origem: pick.origem,
        destino: pick.destino,
        score: pick.score,
        reason: pick.reason,
        breakdown: pick.breakdown,
    };
}
/** Validação auxiliar. */
function explainDirectedBlock(owner, origem, destino) {
    const key = (0, conversation_graph_service_1.buildConversationPairKey)(origem, destino);
    const pair = owner.pairs[key];
    if (!pair)
        return "par inexistente no grafo";
    const gate = (0, conversation_graph_service_1.getPairDirectionAllowed)(pair, origem, destino);
    return gate.ok ? "ok" : gate.reason || "bloqueado";
}
