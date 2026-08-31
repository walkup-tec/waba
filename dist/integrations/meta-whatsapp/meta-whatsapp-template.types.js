"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualityScoreFromGraph = qualityScoreFromGraph;
exports.toPublicTemplate = toPublicTemplate;
exports.isTemplateApprovedForSend = isTemplateApprovedForSend;
function qualityScoreFromGraph(value) {
    if (value == null)
        return null;
    if (typeof value === "string")
        return value.trim() || null;
    if (typeof value === "object") {
        const score = String(value.score || "").trim();
        return score || null;
    }
    return String(value).trim() || null;
}
function toPublicTemplate(row) {
    return {
        id: row.id,
        metaTemplateId: row.metaTemplateId,
        name: row.name,
        language: row.language,
        category: row.category,
        status: row.status,
        qualityScore: row.qualityScore,
        components: row.components,
        rejectedReason: row.rejectedReason,
        lastSyncedAt: row.lastSyncedAt,
    };
}
function isTemplateApprovedForSend(status) {
    return String(status || "").trim().toUpperCase() === "APPROVED";
}
