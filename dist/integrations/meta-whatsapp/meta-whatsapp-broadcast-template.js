"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBroadcastColumnMapping = resolveBroadcastColumnMapping;
exports.inspectMetaBroadcastTemplate = inspectMetaBroadcastTemplate;
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
const waba_shortener_repository_1 = require("../../shortener/waba-shortener.repository");
/** Uma variável de BODY no máximo: nome ou número. Telefone de destino é sempre o destinatário. */
function resolveBroadcastColumnMapping(bodyVariables) {
    const keys = (bodyVariables || []).map((item) => String(item.key || "").trim().toLowerCase());
    const hasNome = keys.includes("nome");
    const hasNumero = keys.includes("numero");
    const hasTexto = keys.includes("texto");
    return {
        phone: true,
        nome: hasNome,
        numero: hasNumero && !hasNome,
        texto: hasTexto && !hasNome && !hasNumero,
    };
}
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function guessVariableKey(bodyText, example, index) {
    const sample = String(example || "").replace(/\D/g, "");
    if (sample.length >= 8)
        return "numero";
    const around = bodyText.toLowerCase();
    if (index === 1 && /\bnome\b|olá,\s*\{\{1\}\}/i.test(around))
        return "nome";
    if (/\bn[uú]mero\b|protocolo|pedido|os\b/.test(around) && sample.length >= 3 && /^\d/.test(example)) {
        return "numero";
    }
    if (/[a-záéíóúãõ]{2,}/i.test(example))
        return "nome";
    return "texto";
}
function bodyExampleValues(example) {
    const row = asRecord(example);
    const nested = row.body_text;
    if (Array.isArray(nested) && Array.isArray(nested[0])) {
        return nested[0].map((item) => String(item || "").trim());
    }
    if (Array.isArray(nested))
        return nested.map((item) => String(item || "").trim());
    return [];
}
function inspectMetaBroadcastTemplate(components) {
    const list = Array.isArray(components) ? components : [];
    let headerFormat = "NONE";
    const bodyVariables = [];
    let urlButton = null;
    for (const item of list) {
        const row = asRecord(item);
        const type = String(row.type || "").trim().toUpperCase();
        if (type === "HEADER") {
            const format = String(row.format || "TEXT").trim().toUpperCase();
            if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT" || format === "LOCATION" || format === "TEXT") {
                headerFormat = format;
            }
        }
        if (type === "BODY") {
            const text = String(row.text || "");
            const indexes = (0, meta_whatsapp_template_validate_1.placeholderIndexes)(text);
            const examples = bodyExampleValues(row.example);
            for (const index of indexes) {
                const example = String(examples[index - 1] || "").trim();
                const key = guessVariableKey(text, example, index);
                bodyVariables.push({
                    index,
                    key,
                    label: key === "nome" ? "Variável Nome" : key === "numero" ? "Variável Número" : `Variável {{${index}}}`,
                });
            }
        }
        if (type === "BUTTONS" && Array.isArray(row.buttons)) {
            row.buttons.forEach((button, index) => {
                const btn = asRecord(button);
                if (String(btn.type || "").trim().toUpperCase() !== "URL")
                    return;
                if (urlButton)
                    return;
                const url = String(btn.url || "").trim();
                urlButton = {
                    index,
                    url,
                    hasVariable: (0, meta_whatsapp_template_validate_1.placeholderIndexes)(url).length > 0,
                    slug: (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(url),
                };
            });
        }
    }
    return { headerFormat, bodyVariables, urlButton };
}
