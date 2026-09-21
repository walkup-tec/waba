"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitInboxButtonText = splitInboxButtonText;
exports.windowStateFromCare = windowStateFromCare;
exports.previewFromContent = previewFromContent;
exports.toPublicInboxConversation = toPublicInboxConversation;
exports.toPublicInboxMessage = toPublicInboxMessage;
/** Separa o rótulo persistido como `texto [Botão]` no envio de CTA. */
function splitInboxButtonText(text, type) {
    const raw = String(text || "");
    const buttons = [];
    let body = raw;
    const trailing = /\s*\[([^\[\]]{1,40})\]\s*$/;
    const preferType = type === "cta_url" || type === "interactive";
    while (true) {
        const match = body.match(trailing);
        if (!match)
            break;
        const label = String(match[1] || "").trim();
        if (!label)
            break;
        if (!preferType && label.length > 25)
            break;
        buttons.unshift({ label });
        body = body.slice(0, match.index).replace(/\s+$/g, "");
        if (!preferType)
            break;
    }
    const cleaned = body.trim();
    return { text: cleaned || null, buttons };
}
function windowStateFromCare(window) {
    if (!window.known || window.withinWindow == null)
        return "UNKNOWN";
    return window.withinWindow ? "OPEN" : "CLOSED";
}
function previewFromContent(input) {
    const text = String(input.text || "")
        .replace(/\s+/g, " ")
        .trim();
    if (text)
        return text.slice(0, 80);
    if (String(input.type || "") === "template") {
        const name = String(input.templateName || "template").trim();
        return `Template: ${name}`.slice(0, 80);
    }
    return "";
}
function toPublicInboxConversation(row, window, channel) {
    return {
        id: row.id,
        contactName: row.contactName,
        contactPhone: row.contactPhone,
        contactWaId: row.contactWaId,
        lastMessagePreview: row.lastMessagePreview,
        lastMessageAt: row.lastMessageAt,
        unreadCount: row.unreadCount,
        status: row.status,
        assignedTo: row.assignedTo,
        humanTakeover: row.humanTakeover,
        phoneNumberId: row.phoneNumberId,
        channelName: channel?.name || null,
        channelPhone: channel?.phone || null,
        channelPhotoUrl: channel?.photoUrl || null,
        agentKind: row.humanTakeover ? "human" : "bot",
        customerCareWindow: {
            known: window.known,
            withinWindow: window.withinWindow,
            state: windowStateFromCare(window),
        },
    };
}
function toPublicInboxMessage(row) {
    const source = row.direction === "inbound" ? "contact" : row.provider === "automation" ? "bot" : "human";
    const split = splitInboxButtonText(row.textContent, row.type);
    return {
        id: row.id,
        direction: row.direction,
        type: row.type,
        status: row.status,
        text: split.text,
        buttons: split.buttons,
        templateName: row.templateName,
        createdAt: row.createdAt,
        errorMessage: row.status === "failed" ? row.errorMessage || "Não foi possível enviar." : null,
        source,
    };
}
