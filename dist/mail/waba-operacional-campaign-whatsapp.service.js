"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverOperacionalNewCampaignWhatsApp = void 0;
const evo_http_client_1 = require("../evo-http.client");
const evo_text_alert_client_1 = require("../monitoring/evo-text-alert.client");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
const waba_push_repository_1 = require("../push/waba-push.repository");
const waba_push_types_1 = require("../push/waba-push.types");
const waba_mail_templates_1 = require("./waba-mail.templates");
const DEFAULT_OPERACIONAL_PRIMARY_PHONE = "51981077770";
const DEFAULT_OPERACIONAL_FALLBACK_PHONE = "5197462102";
const resolveOperacionalPrimaryPhoneHint = () => String(process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE || DEFAULT_OPERACIONAL_PRIMARY_PHONE).trim();
const resolveOperacionalFallbackPhoneHint = () => String(process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE || DEFAULT_OPERACIONAL_FALLBACK_PHONE).trim();
const uniqueInstanceNames = (names) => {
    const seen = new Set();
    const out = [];
    for (const name of names) {
        const trimmed = String(name || "").trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
};
const resolveOperacionalWhatsAppPreferredInstance = () => {
    const fromEnv = String(process.env.WABA_OPERACIONAL_NOTIFY_WHATSAPP_EVO_INSTANCE || "").trim();
    if (fromEnv)
        return fromEnv;
    const pushConfig = new waba_push_repository_1.WabaPushRepository().readConfig();
    const fromPush = String(pushConfig.communityEvoInstance || "").trim();
    if (fromPush)
        return fromPush;
    return (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)();
};
const isRecoverableSendFailure = (detail, status) => {
    const text = String(detail || "").toLowerCase();
    if (status === 404)
        return true;
    if (text.includes("not found") || text.includes("does not exist"))
        return true;
    if (text.includes("instance") && text.includes("exist"))
        return true;
    if (text.includes("disconnected") || text.includes("not connected"))
        return true;
    if (text.includes("integrationsession") || text.includes("internal server error"))
        return true;
    return false;
};
const buildOperacionalSendCandidates = async () => {
    const primaryPhone = resolveOperacionalPrimaryPhoneHint();
    const fallbackPhone = resolveOperacionalFallbackPhoneHint();
    const primaryByPhone = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(primaryPhone);
    if (primaryByPhone) {
        console.info(`[whatsapp] operacional campanha: instância primária ${primaryByPhone} (${primaryPhone}) conectada.`);
        return [primaryByPhone];
    }
    const fallbackByPhone = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(fallbackPhone);
    if (fallbackByPhone) {
        console.info(`[whatsapp] operacional campanha: primária ${primaryPhone} indisponível; usando ${fallbackByPhone} (${fallbackPhone}).`);
        return [fallbackByPhone];
    }
    console.warn(`[whatsapp] operacional campanha: instâncias ${primaryPhone} e ${fallbackPhone} indisponíveis; tentando resolução legada.`);
    const preferred = resolveOperacionalWhatsAppPreferredInstance();
    const candidates = uniqueInstanceNames([
        preferred,
        ...(0, waba_push_types_1.resolvePushCommunityEvoInstanceFallbacks)(),
        (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)(),
    ]);
    const resolved = [];
    for (const candidate of candidates) {
        try {
            const connected = await (0, waba_push_community_service_1.resolveConnectedEvoOutboundInstance)(candidate);
            if (connected)
                resolved.push(connected);
        }
        catch {
            resolved.push(candidate);
        }
    }
    return uniqueInstanceNames(resolved);
};
const deliverOperacionalNewCampaignWhatsApp = async (input) => {
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    const operacionalEmail = String(input.recipientEmail || "").trim().toLowerCase();
    if (!whatsapp || whatsapp.length < 10) {
        return {
            status: "skipped",
            message: `operacional campanha WhatsApp ${operacionalEmail}: número do operador inválido.`,
        };
    }
    const text = (0, waba_mail_templates_1.buildOperacionalNewCampaignWhatsAppText)(input);
    const candidates = await buildOperacionalSendCandidates();
    if (!candidates.length) {
        return {
            status: "skipped",
            message: `operacional campanha WhatsApp ${operacionalEmail}: nenhuma instância Evolution disponível.`,
        };
    }
    const errors = [];
    const timeoutMs = (0, evo_http_client_1.defaultEvoSendTextTimeoutMs)();
    for (const instanceName of candidates) {
        const result = await (0, evo_text_alert_client_1.sendEvoTextAlert)({
            instanceName,
            targetNumber: whatsapp,
            text,
            timeoutMs,
        });
        if (result.ok) {
            console.log(`[whatsapp] operacional campanha enviada para ${whatsapp} (${operacionalEmail}) via ${instanceName}.`);
            return { status: "sent", message: "WhatsApp enviado.", instanceName };
        }
        const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
        errors.push(`${instanceName}: ${detail}`);
        console.warn(`[whatsapp] operacional campanha tentativa falhou (${instanceName}) para ${whatsapp} (${operacionalEmail}):`, detail);
        if (!isRecoverableSendFailure(detail, result.status))
            break;
    }
    const message = errors.join(" | ") || `operacional campanha WhatsApp ${operacionalEmail}: falha desconhecida.`;
    console.error(`[whatsapp] operacional campanha falhou para ${whatsapp} (${operacionalEmail}):`, message);
    return { status: "failed", message };
};
exports.deliverOperacionalNewCampaignWhatsApp = deliverOperacionalNewCampaignWhatsApp;
