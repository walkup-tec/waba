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
    const minutesIdle = minutesSinceLastPair(pair.lastMessageAt);
    // 1) Desequilíbrio de sentido — prioridade alta, mas não absoluta sobre cobertura.
    const balanceScore = absBalance * 1000000;
    // 2) Volume do relacionamento vs média da rede — pares atrasados sobem.
    const volumeDeficit = Math.max(0, ctx.avgPairTotal - total);
    const volumeScore = volumeDeficit * 50000;
    // 3) Penalização por repetição do mesmo relacionamento (mesmo alternando sentido).
    let repetitionPenalty = 0;
    if (ctx.lastSelectedPairKey && ctx.lastSelectedPairKey === pairKey) {
        repetitionPenalty = 5000000000; // hard demote — quase nunca escolhe o mesmo par em seguida
    }
    // Penalização crescente por uso recente no dia.
    repetitionPenalty += usageToday * 200000;
    // Se acabou de interagir há poucos minutos, demove.
    if (minutesIdle < 15) {
        repetitionPenalty += (15 - minutesIdle) * 80000;
    }
    // 4) Cobertura: par sem histórico sobe fortemente.
    const coverageScore = total === 0 ? 2000000 : Math.max(0, 8 - total) * 80000;
    // 5) Participação dos números (origem pouco enviou / destino pouco recebeu).
    const participationScore = (ctx.avgSentToday - originSent) * 1000 + (ctx.avgRecvToday - destRecv) * 100;
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
    if (ctx.lastSelectedPairKey === pairKey)
        reasons.push("penalidade: mesmo par anterior");
    if (usageToday > 0)
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
    const raw = (0, conversation_graph_service_1.listDirectedCandidatesForInstances)(owner, names);
    const reducesToOneOrLess = raw.filter(({ origem, destino, pair }) => {
        const direction = origem.localeCompare(pair.a) === 0 && destino.localeCompare(pair.b) === 0
            ? "a_to_b"
            : "b_to_a";
        const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
        return Math.abs(nextBalance) <= 1;
    });
    let pool = reducesToOneOrLess.length ? reducesToOneOrLess : raw;
    // Preferir candidatos que NÃO são o último par — evita A↔B ping-pong.
    const lastKey = owner.lastSelectedPairKey || null;
    if (lastKey && pool.length > 1) {
        const withoutLast = pool.filter((c) => c.pairKey !== lastKey);
        if (withoutLast.length)
            pool = withoutLast;
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
