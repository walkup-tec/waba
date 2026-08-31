"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNetworkHealthReport = buildNetworkHealthReport;
const conversation_graph_service_1 = require("./conversation-graph.service");
function toPhoneRows(owner) {
    const today = (0, conversation_graph_service_1.dayKeySaoPaulo)();
    const rows = [];
    for (const stats of Object.values(owner.phones)) {
        const sentToday = stats.dayKey === today ? stats.sentToday : 0;
        const receivedToday = stats.dayKey === today ? stats.receivedToday : 0;
        rows.push({
            phone: stats.phone,
            sentToday,
            receivedToday,
            sentTotal: stats.sentTotal,
            receivedTotal: stats.receivedTotal,
            diffToday: sentToday - receivedToday,
            totalToday: sentToday + receivedToday,
        });
    }
    rows.sort((a, b) => b.totalToday - a.totalToday || a.phone.localeCompare(b.phone));
    return rows;
}
function toPairRows(owner) {
    const today = (0, conversation_graph_service_1.dayKeySaoPaulo)();
    const rows = Object.entries(owner.pairs).map(([pairKey, pair]) => ({
        pairKey,
        a: pair.a,
        b: pair.b,
        sentAB: pair.sentAB,
        sentBA: pair.sentBA,
        balance: pair.balance,
        absBalance: Math.abs(pair.balance),
        totalMessages: pair.totalMessages,
        usageToday: pair.dayKey === today ? pair.usageToday || 0 : 0,
        lastMessageAt: pair.lastMessageAt,
        lastDirection: pair.lastDirection,
    }));
    rows.sort((a, b) => b.absBalance - a.absBalance || b.totalMessages - a.totalMessages);
    return rows;
}
function stdDev(values) {
    if (values.length < 2)
        return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
    return Math.sqrt(variance);
}
function buildRelationshipMatrix(owner, labels) {
    const sorted = [...labels].map((l) => String(l || "").trim()).filter(Boolean);
    sorted.sort((a, b) => a.localeCompare(b));
    const cells = sorted.map(() => sorted.map(() => null));
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = 0; j < sorted.length; j += 1) {
            if (i === j) {
                cells[i][j] = null;
                continue;
            }
            const key = (0, conversation_graph_service_1.buildConversationPairKey)(sorted[i], sorted[j]);
            cells[i][j] = owner.pairs[key]?.totalMessages || 0;
        }
    }
    return { labels: sorted, cells };
}
function buildNetworkHealthReport(ownerEmail, owner, options = {}) {
    const phones = toPhoneRows(owner);
    const pairs = toPairRows(owner);
    const labels = options.instanceNames?.length
        ? options.instanceNames
        : phones.map((p) => p.phone);
    const n = labels.length;
    const possiblePairs = n >= 2 ? (n * (n - 1)) / 2 : 0;
    const activePairs = pairs.filter((p) => p.totalMessages > 0).length;
    const networkCoveragePercent = possiblePairs > 0
        ? Math.round((activePairs / possiblePairs) * 1000) / 10
        : 100;
    const totals = pairs.map((p) => p.totalMessages);
    const pairUsageStdDev = Math.round(stdDev(totals) * 10) / 10;
    const pairUsageMax = totals.length ? Math.max(...totals) : 0;
    const pairUsageMin = totals.length ? Math.min(...totals) : 0;
    const totalMessages = pairs.reduce((s, p) => s + p.totalMessages, 0);
    const sumAbsBalance = pairs.reduce((s, p) => s + p.absBalance, 0);
    const reciprocityPercent = totalMessages > 0
        ? Math.max(0, Math.min(100, (1 - sumAbsBalance / totalMessages) * 100))
        : 100;
    const avgSentToday = phones.length > 0 ? phones.reduce((s, p) => s + p.sentToday, 0) / phones.length : 0;
    const avgReceivedToday = phones.length > 0 ? phones.reduce((s, p) => s + p.receivedToday, 0) / phones.length : 0;
    const unbalanced = pairs.filter((p) => p.absBalance > 1);
    const byActivity = [...phones].sort((a, b) => b.totalToday - a.totalToday);
    const least = [...phones].sort((a, b) => a.totalToday - b.totalToday);
    const mostUsedPairs = [...pairs].sort((a, b) => b.totalMessages - a.totalMessages || a.pairKey.localeCompare(b.pairKey));
    const leastUsedPairs = [...pairs].sort((a, b) => a.totalMessages - b.totalMessages || a.pairKey.localeCompare(b.pairKey));
    const history = Array.isArray(owner.selectionHistory) ? owner.selectionHistory : [];
    return {
        ownerEmail: String(ownerEmail || "").trim().toLowerCase(),
        generatedAt: new Date().toISOString(),
        totalMessages,
        pairCount: pairs.length,
        phoneCount: phones.length,
        reciprocityPercent: Math.round(reciprocityPercent * 10) / 10,
        avgSentToday: Math.round(avgSentToday * 10) / 10,
        avgReceivedToday: Math.round(avgReceivedToday * 10) / 10,
        unbalancedPairCount: unbalanced.length,
        networkCoveragePercent,
        pairUsageStdDev,
        pairUsageMax,
        pairUsageMin,
        pairUsageSpread: pairUsageMax - pairUsageMin,
        relationshipMatrix: buildRelationshipMatrix(owner, labels),
        mostUsedPairs: mostUsedPairs.slice(0, 12),
        leastUsedPairs: leastUsedPairs.slice(0, 12),
        selectionHistory: history.slice(0, 20),
        lastPick: history[0] || null,
        phones,
        pairs,
        topUnbalancedPairs: unbalanced.slice(0, 12),
        mostActivePhones: byActivity.slice(0, 8),
        leastActivePhones: least.slice(0, 8),
        balanceRanking: [...pairs].sort((a, b) => b.absBalance - a.absBalance).slice(0, 20),
    };
}
