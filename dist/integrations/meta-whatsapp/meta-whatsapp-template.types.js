"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualityScoreFromGraph = qualityScoreFromGraph;
exports.toPublicTemplate = toPublicTemplate;
exports.isTemplateApprovedForSend = isTemplateApprovedForSend;
const meta_whatsapp_template_silent_block_button_1 = require("./meta-whatsapp-template-silent-block-button");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
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
function toPublicTemplate(row, portfolioName) {
    const name = String(portfolioName || "").trim();
    return {
        id: row.id,
        metaTemplateId: row.metaTemplateId,
        name: row.name,
        language: row.language,
        category: row.category,
        status: row.status,
        qualityScore: row.qualityScore,
        components: (0, meta_whatsapp_template_silent_block_button_1.stripSilentBlockButtonsFromPublicComponents)(row.components),
        rejectedReason: row.rejectedReason,
        lastSyncedAt: row.lastSyncedAt,
        connectionId: row.connectionId,
        portfolioName: name || null,
        headerPreviewUrl: (0, meta_whatsapp_template_header_preview_store_1.publicTemplateHeaderPreviewUrl)({
            id: row.id,
            tenantId: row.tenantId,
            components: row.components,
        }),
    };
}
function isTemplateApprovedForSend(status) {
    return String(status || "").trim().toUpperCase() === "APPROVED";
}
