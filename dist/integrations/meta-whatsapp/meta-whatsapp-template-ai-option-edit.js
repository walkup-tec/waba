"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_TEMPLATE_AI_BODY_MAX = void 0;
exports.normalizeEditedMetaTemplateAiOptionBody = normalizeEditedMetaTemplateAiOptionBody;
exports.assertEditedMetaTemplateAiOptionBody = assertEditedMetaTemplateAiOptionBody;
exports.parseMetaTemplateAiOptionBodyOverrides = parseMetaTemplateAiOptionBodyOverrides;
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
/** Limite do BODY na Cloud API / templates. */
exports.META_TEMPLATE_AI_BODY_MAX = 1024;
function normalizeEditedMetaTemplateAiOptionBody(raw) {
    return String(raw ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function assertEditedMetaTemplateAiOptionBody(raw) {
    const text = normalizeEditedMetaTemplateAiOptionBody(raw);
    if (!text || text.length > exports.META_TEMPLATE_AI_BODY_MAX) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    const placeholders = (0, meta_whatsapp_template_validate_1.placeholderIndexes)(text);
    if (placeholders.some((value, index) => value !== index + 1)) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    return text;
}
function parseMetaTemplateAiOptionBodyOverrides(input) {
    const raw = input?.optionBodies ?? input?.option_bodies;
    if (!Array.isArray(raw))
        return [];
    const out = [];
    raw.slice(0, 3).forEach((item, fallbackIndex) => {
        if (item == null || item === "")
            return;
        if (typeof item === "string") {
            out.push({ index: fallbackIndex, body: item });
            return;
        }
        if (typeof item === "object") {
            const row = item;
            const index = Number.isInteger(Number(row.index)) ? Number(row.index) : fallbackIndex;
            if (row.body == null)
                return;
            out.push({ index, body: String(row.body) });
        }
    });
    return out;
}
