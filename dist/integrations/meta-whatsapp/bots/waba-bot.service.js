"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaBotService = void 0;
exports.resetWabaBotTestRunsForTests = resetWabaBotTestRunsForTests;
const meta_whatsapp_errors_1 = require("../meta-whatsapp-errors");
const meta_whatsapp_tenant_1 = require("../meta-whatsapp-tenant");
const meta_whatsapp_phone_identity_store_1 = require("../meta-whatsapp-phone-identity.store");
const waba_bot_node_registry_1 = require("./waba-bot-node.registry");
const waba_bot_flow_normalize_1 = require("./waba-bot-flow.normalize");
const waba_bot_runtime_engine_1 = require("./waba-bot-runtime.engine");
const waba_bot_store_1 = require("./waba-bot.store");
const testRuns = new Map();
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
class WabaBotService {
    getCatalog() {
        return {
            nodes: waba_bot_node_registry_1.BOT_NODE_REGISTRY.map((item) => ({
                kind: item.kind,
                category: item.category,
                label: item.label,
                description: item.description,
                outputs: item.outputs,
                defaultConfig: item.defaultConfig,
            })),
        };
    }
    list(auth) {
        const tenant = requireTenant(auth);
        const flows = (0, waba_bot_store_1.listBotFlows)(tenant.tenantId);
        const links = (0, waba_bot_store_1.listBotPhoneLinks)(tenant.tenantId);
        const channels = (0, meta_whatsapp_phone_identity_store_1.listPhoneInboxChannels)(tenant.tenantId);
        return {
            tenantId: tenant.tenantId,
            flows,
            links,
            channels: channels.map((row) => ({
                phoneNumberId: row.phoneNumberId,
                name: row.name,
                displayPhoneNumber: row.displayPhoneNumber,
                inboxEnabled: row.inboxEnabled,
                inboxEligible: row.inboxEligible,
                botId: (0, waba_bot_store_1.getBotIdForPhone)(tenant.tenantId, row.phoneNumberId),
            })),
            catalog: this.getCatalog(),
        };
    }
    upsert(auth, body) {
        const tenant = requireTenant(auth);
        const draft = (0, waba_bot_flow_normalize_1.normalizeBotDraft)(body);
        if (!(0, waba_bot_runtime_engine_1.findStartNode)(draft))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        return (0, waba_bot_store_1.upsertBotFlow)(tenant.tenantId, draft);
    }
    create(auth, name) {
        const tenant = requireTenant(auth);
        return (0, waba_bot_store_1.upsertBotFlow)(tenant.tenantId, (0, waba_bot_flow_normalize_1.createDefaultBotDraft)(String(name || "Novo bot").trim() || "Novo bot"));
    }
    remove(auth, botId) {
        const tenant = requireTenant(auth);
        const ok = (0, waba_bot_store_1.deleteBotFlow)(tenant.tenantId, botId);
        if (!ok)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        return { ok: true };
    }
    linkPhone(auth, body) {
        const tenant = requireTenant(auth);
        const phoneNumberId = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
        const botIdRaw = body?.botId ?? body?.bot_id;
        const botId = botIdRaw == null || botIdRaw === "" ? null : String(botIdRaw).trim();
        if (!phoneNumberId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const links = (0, waba_bot_store_1.setBotPhoneLink)({
            tenantId: tenant.tenantId,
            phoneNumberId,
            botId,
        });
        return { ok: true, links };
    }
    async testNode(auth, body) {
        requireTenant(auth);
        const node = body?.node;
        if (!node?.data?.kind)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        return (0, waba_bot_runtime_engine_1.executeBotNode)({
            node,
            variables: body?.variables && typeof body.variables === "object"
                ? body.variables
                : {},
            dryRun: true,
            inboundText: body?.inboundText != null ? String(body.inboundText) : null,
        });
    }
    async startTest(auth, body) {
        requireTenant(auth);
        const flow = (0, waba_bot_flow_normalize_1.normalizeBotDraft)(body?.flow);
        if (!(0, waba_bot_runtime_engine_1.findStartNode)(flow))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        const phone = String(body?.testPhone || body?.test_phone || "00000000000").trim();
        let run = (0, waba_bot_runtime_engine_1.createBotRunState)({ flow, testPhone: phone });
        const advanced = await (0, waba_bot_runtime_engine_1.advanceBotRun)({ flow, run });
        run = advanced.run;
        testRuns.set(run.id, run);
        return { ok: true, run, outboundTexts: advanced.outboundTexts };
    }
    async continueTest(auth, body) {
        requireTenant(auth);
        const runId = String(body?.runId || body?.run_id || "").trim();
        const current = testRuns.get(runId);
        if (!current)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        const flow = (0, waba_bot_flow_normalize_1.normalizeBotDraft)(body?.flow);
        const advanced = await (0, waba_bot_runtime_engine_1.advanceBotRun)({
            flow,
            run: current,
            inboundText: body?.inboundText != null ? String(body.inboundText) : undefined,
        });
        testRuns.set(advanced.run.id, advanced.run);
        return { ok: true, run: advanced.run, outboundTexts: advanced.outboundTexts };
    }
    get(auth, botId) {
        const tenant = requireTenant(auth);
        const flow = (0, waba_bot_store_1.readBotFlow)(tenant.tenantId, botId);
        if (!flow)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("conversation_not_found");
        return flow;
    }
}
exports.WabaBotService = WabaBotService;
function resetWabaBotTestRunsForTests() {
    testRuns.clear();
}
