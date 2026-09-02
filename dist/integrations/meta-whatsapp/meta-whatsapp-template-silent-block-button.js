"use strict";
/**
 * Botão silencioso injetado só no POST Graph.
 * Tipo Meta: QUICK_REPLY ("Personalizado" no Gerenciador).
 * Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
 * Agrupamento obrigatório: todos os não-QR juntos, todos os QR juntos.
 * Ordem WABA: botão do usuário (URL/PHONE) primeiro, depois Bloquear.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_SILENT_BLOCK_BUTTON = exports.META_SILENT_BLOCK_BUTTON_TEXT = void 0;
exports.isSilentBlockButton = isSilentBlockButton;
exports.appendSilentBlockButton = appendSilentBlockButton;
exports.stripSilentBlockButtonsFromPublicComponents = stripSilentBlockButtonsFromPublicComponents;
exports.META_SILENT_BLOCK_BUTTON_TEXT = "Bloquear";
exports.META_SILENT_BLOCK_BUTTON = {
    type: "QUICK_REPLY",
    text: exports.META_SILENT_BLOCK_BUTTON_TEXT,
};
const MAX_TEMPLATE_BUTTONS = 10;
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function isSilentBlockButton(raw) {
    const row = asRecord(raw);
    return (String(row.type || "").trim().toUpperCase() === "QUICK_REPLY" &&
        String(row.text || "").trim().toLowerCase() === exports.META_SILENT_BLOCK_BUTTON_TEXT.toLowerCase());
}
function groupButtonsForMeta(buttons) {
    const nonQr = buttons.filter((item) => String(item.type || "").trim().toUpperCase() !== "QUICK_REPLY");
    const qr = buttons.filter((item) => String(item.type || "").trim().toUpperCase() === "QUICK_REPLY");
    return [...nonQr, ...qr];
}
function appendSilentBlockButton(components) {
    const silent = {
        type: exports.META_SILENT_BLOCK_BUTTON.type,
        text: exports.META_SILENT_BLOCK_BUTTON.text,
    };
    const next = components.map((item) => ({ ...item }));
    const index = next.findIndex((item) => String(item.type || "").trim().toUpperCase() === "BUTTONS");
    if (index < 0) {
        next.push({ type: "BUTTONS", buttons: [silent] });
        return next;
    }
    const existing = Array.isArray(next[index].buttons) ? next[index].buttons : [];
    const withoutSilent = existing
        .filter((item) => !isSilentBlockButton(item))
        .map((item) => asRecord(item));
    const userButtons = withoutSilent.slice(0, MAX_TEMPLATE_BUTTONS - 1);
    next[index] = {
        ...next[index],
        buttons: groupButtonsForMeta([...userButtons, silent]),
    };
    return next;
}
function stripSilentBlockButtonsFromPublicComponents(components) {
    if (!Array.isArray(components))
        return components;
    const next = components
        .map((item) => {
        const row = asRecord(item);
        if (String(row.type || "").trim().toUpperCase() !== "BUTTONS")
            return item;
        const buttons = Array.isArray(row.buttons) ? row.buttons.filter((button) => !isSilentBlockButton(button)) : [];
        if (!buttons.length)
            return null;
        return { ...row, buttons };
    })
        .filter((item) => item != null);
    return next;
}
