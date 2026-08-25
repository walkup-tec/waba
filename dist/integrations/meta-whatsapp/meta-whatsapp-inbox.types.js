"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.windowStateFromCare = windowStateFromCare;
exports.previewFromContent = previewFromContent;
exports.toPublicInboxConversation = toPublicInboxConversation;
exports.toPublicInboxMessage = toPublicInboxMessage;
function windowStateFromCare(window) {
    if (!window.known || window.withinWindow == null)
        return "UNKNOWN";
    return window.withinWindow ? "OPEN" : "CLOSED";
}
function previewFromContent(input) {
    if (String(input.type || "") === "template") {
        const name = String(input.templateName || "template").trim();
        return `Template: ${name}`.slice(0, 80);
    }
    return String(input.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}
function toPublicInboxConversation(row, window) {
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
        customerCareWindow: {
            known: window.known,
            withinWindow: window.withinWindow,
            state: windowStateFromCare(window),
        },
    };
}
function toPublicInboxMessage(row) {
    return {
        id: row.id,
        direction: row.direction,
        type: row.type,
        status: row.status,
        text: row.textContent,
        templateName: row.templateName,
        createdAt: row.createdAt,
        errorMessage: row.status === "failed" ? row.errorMessage || "Não foi possível enviar." : null,
    };
}
