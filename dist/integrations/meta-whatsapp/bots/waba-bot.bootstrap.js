"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWabaBots = startWabaBots;
exports.stopWabaBotsForTests = stopWabaBotsForTests;
const meta_whatsapp_inbox_events_1 = require("../meta-whatsapp-inbox-events");
const waba_bot_inbound_service_1 = require("./waba-bot-inbound.service");
let started = false;
let unsubscribe = null;
/**
 * Assina inbound_message depois do persist. Não vive no handler HTTP do webhook.
 */
function startWabaBots(service) {
    if (started)
        return;
    started = true;
    const instance = service || new waba_bot_inbound_service_1.WabaBotInboundService();
    unsubscribe = (0, meta_whatsapp_inbox_events_1.onInboundMessage)(async (event) => {
        await instance.handleInbound(event);
    });
}
function stopWabaBotsForTests() {
    started = false;
    if (unsubscribe)
        unsubscribe();
    unsubscribe = null;
}
