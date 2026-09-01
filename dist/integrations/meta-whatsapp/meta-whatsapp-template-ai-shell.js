"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_TEMPLATE_AI_FIXED_HEADER_TEXT = exports.META_TEMPLATE_AI_BUTTON_LABELS = void 0;
exports.sanitizeMetaTemplateName = sanitizeMetaTemplateName;
exports.templateNameForOption = templateNameForOption;
exports.parseMetaTemplateAiShell = parseMetaTemplateAiShell;
exports.stripTemplatePlaceholders = stripTemplatePlaceholders;
exports.componentsFromAiOptionAndShell = componentsFromAiOptionAndShell;
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
/** Mesmas opções do select de botão do Mensageiro (API Alternativa). */
exports.META_TEMPLATE_AI_BUTTON_LABELS = [
    "Quero saber mais",
    "Mais informações",
    "Solicitar agora",
    "Me inscrever",
    "Comprar agora",
];
const VARIABLE_TYPES = new Set(["nenhuma", "nome", "numero"]);
const MEDIA_FORMATS = new Set([
    "NONE",
    "IMAGE",
    "VIDEO",
    "DOCUMENT",
    "LOCATION",
]);
const BUTTON_LABELS = new Set(exports.META_TEMPLATE_AI_BUTTON_LABELS);
const MEDIA_NEEDS_HANDLE = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);
/** HEADER de texto fixo. A Meta aceita um HEADER: este texto, ou mídia. */
exports.META_TEMPLATE_AI_FIXED_HEADER_TEXT = "Informação de utilidade";
function sanitizeMetaTemplateName(raw) {
    return String(raw || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 500);
}
function templateNameForOption(modelName, index) {
    const base = sanitizeMetaTemplateName(modelName);
    if (!base)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    return `${base}_${index + 1}`;
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function requireStaticHttpsUrl(raw) {
    const url = String(raw || "").trim();
    if (!url || url.length > 2000 || (0, meta_whatsapp_template_validate_1.placeholderIndexes)(url).length) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    }
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    }
    if (parsed.protocol !== "https:")
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    return url;
}
function parseMetaTemplateAiShell(input) {
    const body = asRecord(input);
    const modelName = sanitizeMetaTemplateName(String(body.modelName || body.model_name || ""));
    const variableType = String(body.variableType || body.variable_type || "nome")
        .trim()
        .toLowerCase();
    const mediaFormat = String(body.mediaFormat || body.media_format || "NONE")
        .trim()
        .toUpperCase();
    const headerText = exports.META_TEMPLATE_AI_FIXED_HEADER_TEXT;
    const buttonText = String(body.buttonText || body.button_text || "").trim();
    const buttonUrl = requireStaticHttpsUrl(String(body.buttonUrl || body.button_url || ""));
    const headerHandle = String(body.headerHandle || body.header_handle || "").trim();
    if (!modelName || !VARIABLE_TYPES.has(variableType) || !MEDIA_FORMATS.has(mediaFormat)) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    if (!BUTTON_LABELS.has(buttonText) || buttonText.length > 25) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    }
    if (MEDIA_NEEDS_HANDLE.has(mediaFormat) && !headerHandle) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_media_required");
    }
    return {
        modelName,
        variableType,
        mediaFormat,
        headerText,
        buttonText,
        buttonUrl,
        headerHandle: MEDIA_NEEDS_HANDLE.has(mediaFormat) ? headerHandle : "",
    };
}
function exampleForVariable(shell, provided) {
    if (shell.variableType === "numero") {
        const digits = String(provided || "").replace(/\D/g, "");
        return digits || "11999999999";
    }
    const text = String(provided || "").trim();
    return text || "Maria";
}
function stripTemplatePlaceholders(text) {
    return String(text || "")
        .replace(/\{\{\d+\}\}/g, "")
        .replace(/[ \t]+([,.;:!?])/g, "$1")
        .replace(/,(?=[.!?])/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/^[ \t]+/gm, "")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function componentsFromAiOptionAndShell(option, shell) {
    const bodyText = shell.variableType === "nenhuma"
        ? stripTemplatePlaceholders(option.body)
        : option.body;
    const placeholders = shell.variableType === "nenhuma" ? [] : (0, meta_whatsapp_template_validate_1.placeholderIndexes)(bodyText);
    if (placeholders.some((value, index) => value !== index + 1)) {
        throw new Error("Variáveis não sequenciais.");
    }
    if (!bodyText)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_invalid");
    const examples = placeholders.map((_, index) => exampleForVariable(shell, option.variableExamples[index]));
    const components = [];
    if (MEDIA_NEEDS_HANDLE.has(shell.mediaFormat)) {
        components.push({
            type: "HEADER",
            format: shell.mediaFormat,
            example: { header_handle: [shell.headerHandle] },
        });
    }
    else if (shell.mediaFormat === "LOCATION") {
        components.push({ type: "HEADER", format: "LOCATION" });
    }
    else if (shell.headerText) {
        components.push({ type: "HEADER", format: "TEXT", text: shell.headerText });
    }
    components.push({
        type: "BODY",
        text: bodyText,
        ...(examples.length ? { example: { body_text: [examples] } } : {}),
    });
    components.push({
        type: "BUTTONS",
        buttons: [
            {
                type: "URL",
                text: shell.buttonText,
                url: shell.buttonUrl,
            },
        ],
    });
    return components;
}
