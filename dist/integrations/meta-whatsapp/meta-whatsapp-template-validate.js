"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeholderIndexes = placeholderIndexes;
exports.validateTemplateCreate = validateTemplateCreate;
const meta_whatsapp_recipient_1 = require("./meta-whatsapp-recipient");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const NAME_RE = /^[a-z0-9_]{1,512}$/;
const CREATE_CATEGORIES = new Set(["MARKETING", "UTILITY", "AUTHENTICATION"]);
const COMPONENT_TYPES = new Set(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
const HEADER_FORMATS = new Set(["TEXT"]);
const BUTTON_TYPES = new Set(["QUICK_REPLY", "URL", "PHONE_NUMBER"]);
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function placeholderIndexes(text) {
    const found = new Set();
    const re = /\{\{(\d+)\}\}/g;
    let match;
    while ((match = re.exec(String(text || "")))) {
        found.add(Number(match[1]));
    }
    return [...found].sort((a, b) => a - b);
}
function requireExamples(kind, text, example) {
    const indexes = placeholderIndexes(text);
    if (!indexes.length)
        return;
    const row = asRecord(example);
    if (kind === "header") {
        const values = Array.isArray(row.header_text) ? row.header_text : [];
        if (values.length < indexes.length) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        }
        return;
    }
    const nested = Array.isArray(row.body_text) ? row.body_text[0] : null;
    const values = Array.isArray(nested) ? nested : [];
    if (values.length < indexes.length) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
}
function sanitizeButton(raw) {
    const row = asRecord(raw);
    const type = String(row.type || "").trim().toUpperCase();
    if (!BUTTON_TYPES.has(type))
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    const text = String(row.text || "").trim();
    if (!text)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    const out = { type, text };
    if (type === "URL") {
        const url = String(row.url || "").trim();
        if (!url)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        out.url = url;
        if (placeholderIndexes(url).length) {
            const examples = Array.isArray(row.example) ? row.example : [];
            if (!examples.length)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
            out.example = examples;
        }
        else if (row.example) {
            out.example = row.example;
        }
    }
    if (type === "PHONE_NUMBER") {
        const phone = String(row.phone_number || "").trim();
        if (!phone)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        out.phone_number = phone;
    }
    return out;
}
function sanitizeComponent(raw) {
    const row = asRecord(raw);
    const type = String(row.type || "").trim().toUpperCase();
    if (!COMPONENT_TYPES.has(type))
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    if (type === "BODY") {
        const text = String(row.text || "").trim();
        if (!text)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        const out = { type, text };
        if (placeholderIndexes(text).length) {
            if (!row.example)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
            requireExamples("body", text, row.example);
            out.example = row.example;
        }
        return out;
    }
    if (type === "HEADER") {
        const format = String(row.format || "TEXT").trim().toUpperCase();
        if (!HEADER_FORMATS.has(format))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        const text = String(row.text || "").trim();
        if (!text)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        const out = { type, format, text };
        if (placeholderIndexes(text).length) {
            if (!row.example)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
            requireExamples("header", text, row.example);
            out.example = row.example;
        }
        return out;
    }
    if (type === "FOOTER") {
        const text = String(row.text || "").trim();
        if (!text)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
        return { type, text };
    }
    const buttons = Array.isArray(row.buttons) ? row.buttons.slice(0, 10).map(sanitizeButton) : [];
    if (!buttons.length)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    return { type, buttons };
}
function validateTemplateCreate(input) {
    const body = input || {};
    const name = String(body.name || "").trim().toLowerCase();
    const language = (0, meta_whatsapp_recipient_1.normalizeTemplateLanguage)(body.language);
    const category = String(body.category || "").trim().toUpperCase();
    if (!NAME_RE.test(name) || !language)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    if (!CREATE_CATEGORIES.has(category))
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    if (!Array.isArray(body.components) || !body.components.length) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    const components = body.components.slice(0, 8).map(sanitizeComponent);
    if (!components.some((item) => item.type === "BODY")) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    return { name, language, category, components };
}
