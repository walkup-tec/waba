"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMetaWhatsappAutomation = startMetaWhatsappAutomation;
exports.stopMetaWhatsappAutomationForTests = stopMetaWhatsappAutomationForTests;
const meta_whatsapp_inbox_events_1 = require("./meta-whatsapp-inbox-events");
const meta_whatsapp_automation_engine_1 = require("./meta-whatsapp-automation-engine");
let started = false;
let unsubscribe = null;
/**
 * Assina o evento interno inbound_message. Não vive no handler HTTP do webhook.
 */
function startMetaWhatsappAutomation(engine) {
    if (started)
        return;
    started = true;
    const instance = engine || new meta_whatsapp_automation_engine_1.MetaWhatsappAutomationEngine();
    unsubscribe = (0, meta_whatsapp_inbox_events_1.onInboundMessage)((event) => instance.handleInbound(event));
}
function stopMetaWhatsappAutomationForTests() {
    started = false;
    if (unsubscribe)
        unsubscribe();
    unsubscribe = null;
}
