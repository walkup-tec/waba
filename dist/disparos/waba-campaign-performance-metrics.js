"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCampaignPerformanceMetrics = computeCampaignPerformanceMetrics;
const roundMetric = (value) => {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0)
        return 0;
    return parsed;
};
const roundRate = (value) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
/**
 * Taxas iguais ao relatório atual + cliques do Laboratório (Meta Cloud).
 * Taxa de cliques = Cliques ÷ Entregues × 100.
 */
function computeCampaignPerformanceMetrics(raw) {
    const totalLeads = roundMetric(raw.totalLeads);
    const sent = roundMetric(raw.sent);
    const delivered = roundMetric(raw.delivered);
    const read = roundMetric(raw.read);
    const failed = roundMetric(raw.failed);
    const clicks = roundMetric(raw.clicks);
    return {
        totalLeads,
        sent,
        delivered,
        read,
        failed,
        clicks,
        bonusShipments: Math.max(0, totalLeads - sent),
        pendingSent: Math.max(0, sent - delivered - failed),
        deliveryRate: roundRate(sent > 0 ? (delivered / sent) * 100 : 0),
        readRate: roundRate(delivered > 0 ? (read / delivered) * 100 : 0),
        failureRate: roundRate(totalLeads > 0 ? (failed / totalLeads) * 100 : 0),
        clickRate: roundRate(delivered > 0 ? (clicks / delivered) * 100 : 0),
    };
}
