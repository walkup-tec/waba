"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onInboundMessage = onInboundMessage;
exports.onOutboundMessage = onOutboundMessage;
exports.onConversationCreated = onConversationCreated;
exports.onConversationUpdated = onConversationUpdated;
exports.emitMetaInboxEvent = emitMetaInboxEvent;
exports.resetMetaInboxListenersForTests = resetMetaInboxListenersForTests;
const listeners = {
    inbound_message: [],
    outbound_message: [],
    conversation_created: [],
    conversation_updated: [],
};
function onInboundMessage(listener) {
    return subscribe("inbound_message", listener);
}
function onOutboundMessage(listener) {
    return subscribe("outbound_message", listener);
}
function onConversationCreated(listener) {
    return subscribe("conversation_created", listener);
}
function onConversationUpdated(listener) {
    return subscribe("conversation_updated", listener);
}
function subscribe(name, listener) {
    listeners[name].push(listener);
    return () => {
        listeners[name] = listeners[name].filter((item) => item !== listener);
    };
}
async function emitMetaInboxEvent(event) {
    const list = listeners[event.name].slice();
    for (const listener of list) {
        try {
            await listener(event);
        }
        catch {
            // Chatbot/IA futuros não podem derrubar webhook nem envio.
        }
    }
}
function resetMetaInboxListenersForTests() {
    Object.keys(listeners).forEach((key) => {
        listeners[key] = [];
    });
}
