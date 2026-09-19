"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaBotInboundService = void 0;
exports.withConversationBotLock = withConversationBotLock;
exports.resetWabaBotLocksForTests = resetWabaBotLocksForTests;
const meta_whatsapp_conversation_repository_1 = require("../meta-whatsapp-conversation.repository");
const meta_whatsapp_message_repository_1 = require("../meta-whatsapp-message.repository");
const meta_whatsapp_messaging_service_1 = require("../meta-whatsapp-messaging.service");
const meta_whatsapp_customer_care_window_1 = require("../meta-whatsapp-customer-care-window");
const waba_bot_log_1 = require("./waba-bot-log");
const waba_bot_store_1 = require("./waba-bot.store");
const waba_bot_runtime_engine_1 = require("./waba-bot-runtime.engine");
const waba_bot_flow_normalize_1 = require("./waba-bot-flow.normalize");
const conversationBotLocks = new Map();
async function withConversationBotLock(conversationId, fn) {
    const key = String(conversationId || "").trim();
    const previous = conversationBotLocks.get(key) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    conversationBotLocks.set(key, run.then(() => undefined, () => undefined));
    return run;
}
function resetWabaBotLocksForTests() {
    conversationBotLocks.clear();
}
function shouldRestartRun(run, botId) {
    if (!run)
        return true;
    if (run.flowId !== botId)
        return true;
    if (run.phase === "waiting_reply" || run.phase === "running" || run.phase === "starting") {
        return false;
    }
    return run.phase === "finished" || run.phase === "error" || run.phase === "idle";
}
function toSendText(payload) {
    if (payload.type === "text")
        return String(payload.text || "").trim();
    if (payload.type === "interactive") {
        return (0, waba_bot_flow_normalize_1.formatNumberedMenu)(payload.interactive.text, payload.interactive.options.map((opt) => ({ label: opt.label })));
    }
    return "";
}
function toSendBody(payload) {
    if (payload.type === "text") {
        const text = String(payload.text || "").trim();
        return text ? { type: "text", text } : null;
    }
    if (payload.type === "interactive") {
        const text = toSendText(payload);
        return text ? { type: "text", text } : null;
    }
    if (payload.type === "media") {
        const media = payload.media;
        const type = media.mediaKind === "pdf" ? "document" : media.mediaKind;
        return {
            type,
            mediaRef: media.mediaRef || "",
            mediaUrl: media.mediaUrl || "",
            caption: media.caption || "",
            mime: media.mediaMime || "",
            fileName: media.mediaFileName || String(media.mediaUrl || "").split("/").pop() || "",
            voice: media.voiceNote === true,
        };
    }
    if (payload.type === "cta_url") {
        return {
            type: "cta_url",
            text: payload.cta.text,
            buttonLabel: payload.cta.buttonLabel,
            url: payload.cta.url,
        };
    }
    return null;
}
class WabaBotInboundService {
    constructor(deps = {}) {
        this.deps = deps;
    }
    messages() {
        return this.deps.messages || new meta_whatsapp_message_repository_1.MetaWhatsappMessageRepository();
    }
    conversations() {
        return this.deps.conversations || new meta_whatsapp_conversation_repository_1.MetaWhatsappConversationRepository();
    }
    messaging() {
        return this.deps.messaging || new meta_whatsapp_messaging_service_1.MetaWhatsappMessagingService();
    }
    async handleInbound(event) {
        try {
            return await this.processInbound(event);
        }
        catch (error) {
            (0, waba_bot_log_1.logWabaBot)("error", {
                tenantId: event.tenantId,
                conversationId: event.conversationId,
                messageId: event.messageId || null,
                reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
            });
            return false;
        }
    }
    async processInbound(event) {
        if (event.name !== "inbound_message")
            return false;
        const tenantId = String(event.tenantId || "").trim();
        const messageId = String(event.messageId || "").trim();
        const conversationId = String(event.conversationId || "").trim();
        if (!tenantId || !messageId || !conversationId)
            return false;
        return withConversationBotLock(`${tenantId}:${conversationId}`, async () => {
            const message = await this.messages().findByIdForTenant(tenantId, messageId);
            if (!message || message.tenantId !== tenantId || message.direction !== "inbound") {
                return false;
            }
            const conversation = await this.conversations().findByIdForTenant(tenantId, conversationId);
            if (!conversation || conversation.tenantId !== tenantId)
                return false;
            const phoneNumberId = String(conversation.phoneNumberId || "").trim();
            const botId = (0, waba_bot_store_1.getBotIdForPhone)(tenantId, phoneNumberId);
            if (!botId) {
                (0, waba_bot_log_1.logWabaBot)("skip", { tenantId, conversationId, reason: "no_bot_link" });
                return false;
            }
            const flow = (0, waba_bot_store_1.readBotFlow)(tenantId, botId);
            if (!flow || !(0, waba_bot_runtime_engine_1.findStartNode)(flow)) {
                (0, waba_bot_log_1.logWabaBot)("skip", { tenantId, conversationId, reason: "flow_missing" });
                return false;
            }
            let run = (0, waba_bot_store_1.readConversationBotRun)(tenantId, conversationId);
            const botActive = run &&
                !shouldRestartRun(run, botId) &&
                (run.phase === "waiting_reply" || run.phase === "running" || run.phase === "starting");
            if (conversation.humanTakeover && !botActive) {
                (0, waba_bot_log_1.logWabaBot)("skip", { tenantId, conversationId, reason: "human_takeover" });
                return false;
            }
            const claim = (0, waba_bot_store_1.tryClaimBotMessage)({
                tenantId,
                messageId,
                conversationId,
                botId,
            });
            if (!claim.claimed) {
                (0, waba_bot_log_1.logWabaBot)("skip", { tenantId, conversationId, messageId, reason: "duplicate_claim" });
                return true;
            }
            const window = (0, meta_whatsapp_customer_care_window_1.resolveCustomerCareWindow)({ lastInboundAt: conversation.lastInboundAt });
            if (window.known && window.withinWindow === false) {
                (0, waba_bot_log_1.logWabaBot)("skip", { tenantId, conversationId, reason: "outside_24h_window" });
                return true;
            }
            const continueWaiting = Boolean(botActive && run?.phase === "waiting_reply");
            const inboundForAdvance = continueWaiting ? String(message.textContent || "").trim() : undefined;
            if (shouldRestartRun(run, botId)) {
                run = (0, waba_bot_runtime_engine_1.createBotRunState)({
                    flow,
                    testPhone: String(conversation.contactWaId || conversation.contactPhone || ""),
                });
            }
            const advanced = await (0, waba_bot_runtime_engine_1.advanceBotRun)({
                flow,
                run: run,
                inboundText: inboundForAdvance,
                conversationId,
                phone: conversation.contactWaId,
            });
            run = advanced.run;
            (0, waba_bot_store_1.writeConversationBotRun)(tenantId, conversationId, run);
            for (const payload of advanced.outbound) {
                const sendBody = toSendBody(payload);
                if (!sendBody)
                    continue;
                await this.messaging().sendForTenant(tenantId, {
                    ...sendBody,
                    to: conversation.contactWaId,
                    conversationId,
                    phoneNumberId,
                    connectionId: conversation.connectionId,
                    source: "bot",
                });
            }
            if (advanced.transferHuman || run.phase === "finished") {
                if (advanced.transferHuman) {
                    await this.conversations().assign(tenantId, conversationId, conversation.assignedTo, true);
                    (0, waba_bot_store_1.writeConversationBotRun)(tenantId, conversationId, { ...run, phase: "finished" });
                }
            }
            (0, waba_bot_log_1.logWabaBot)("handled", {
                tenantId,
                conversationId,
                messageId,
                botId,
                phase: run.phase,
                outbound: advanced.outbound.length,
            });
            return true;
        });
    }
}
exports.WabaBotInboundService = WabaBotInboundService;
