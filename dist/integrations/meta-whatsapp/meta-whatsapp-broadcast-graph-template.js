"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_TEMPLATE_MISSING_ABORT_AFTER = exports.GRAPH_TEMPLATE_MISSING_CODE = void 0;
exports.shouldAbortBroadcastOnRepeatedTemplateMissing = shouldAbortBroadcastOnRepeatedTemplateMissing;
exports.pickApprovedGraphTemplate = pickApprovedGraphTemplate;
const meta_whatsapp_template_types_1 = require("./meta-whatsapp-template.types");
const meta_whatsapp_recipient_1 = require("./meta-whatsapp-recipient");
exports.GRAPH_TEMPLATE_MISSING_CODE = "132001";
exports.GRAPH_TEMPLATE_MISSING_ABORT_AFTER = 5;
function shouldAbortBroadcastOnRepeatedTemplateMissing(graphCode, consecutive) {
    if (String(graphCode || "").trim() !== exports.GRAPH_TEMPLATE_MISSING_CODE)
        return false;
    return consecutive >= exports.GRAPH_TEMPLATE_MISSING_ABORT_AFTER;
}
/** Usa o registro APPROVED da Graph (nome + idioma), não o cache local do Laboratório. */
function pickApprovedGraphTemplate(items, name, preferredLanguage) {
    const wantName = String(name || "").trim().toLowerCase();
    const wantLang = (0, meta_whatsapp_recipient_1.normalizeTemplateLanguage)(preferredLanguage);
    if (!wantName || !wantLang)
        return null;
    const approved = items.filter((row) => {
        if (!row)
            return false;
        if (String(row.name || "").trim().toLowerCase() !== wantName)
            return false;
        return (0, meta_whatsapp_template_types_1.isTemplateApprovedForSend)(row.status);
    });
    return (approved.find((row) => (0, meta_whatsapp_recipient_1.normalizeTemplateLanguage)(row.language) === wantLang) || null);
}
