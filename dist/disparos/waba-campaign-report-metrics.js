"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANUAL_CAMPAIGN_REPORT_INCOMPLETE_MESSAGE = void 0;
exports.parsePresentNonNegativeInt = parsePresentNonNegativeInt;
exports.parseManualCampaignReportMetrics = parseManualCampaignReportMetrics;
exports.isManualCampaignReportIncomplete = isManualCampaignReportIncomplete;
exports.MANUAL_CAMPAIGN_REPORT_INCOMPLETE_MESSAGE = "Preencha todos os indicadores do relatório (enviados, entregues, lidos e falhados) antes de finalizar a campanha.";
const REQUIRED_FIELDS = ["sent", "delivered", "read", "failed"];
function parsePresentNonNegativeInt(value) {
    if (value == null)
        return null;
    if (typeof value === "boolean")
        return null;
    if (typeof value === "string" && value.trim() === "")
        return null;
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed < 0)
        return null;
    return parsed;
}
function parseManualCampaignReportMetrics(body) {
    const sent = parsePresentNonNegativeInt(body.sent);
    const delivered = parsePresentNonNegativeInt(body.delivered);
    const read = parsePresentNonNegativeInt(body.read);
    const failed = parsePresentNonNegativeInt(body.failed);
    if ([sent, delivered, read, failed].some((value) => value == null)) {
        return null;
    }
    return {
        sent: sent,
        delivered: delivered,
        read: read,
        failed: failed,
    };
}
function isManualCampaignReportIncomplete(metrics) {
    if (!metrics)
        return true;
    return REQUIRED_FIELDS.every((field) => metrics[field] === 0);
}
