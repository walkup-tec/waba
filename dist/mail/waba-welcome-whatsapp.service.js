"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySubscriberWelcomeWhatsApp = exports.deliverSubscriberWelcomeWhatsApp = exports.buildSubscriberWelcomeWhatsAppText = void 0;
const evo_http_client_1 = require("../evo-http.client");
const evo_text_alert_client_1 = require("../monitoring/evo-text-alert.client");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
const waba_push_repository_1 = require("../push/waba-push.repository");
const waba_push_types_1 = require("../push/waba-push.types");
const waba_app_url_1 = require("./waba-app-url");
const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";
const DEFAULT_WELCOME_PRIMARY_PHONE = "51981077770";
const DEFAULT_WELCOME_FALLBACK_PHONE = "5197462102";
const resolveWelcomePrimaryPhoneHint = () => String(process.env.WABA_WELCOME_WHATSAPP_PRIMARY_PHONE || DEFAULT_WELCOME_PRIMARY_PHONE).trim();
const resolveWelcomeFallbackPhoneHint = () => String(process.env.WABA_WELCOME_WHATSAPP_FALLBACK_PHONE || DEFAULT_WELCOME_FALLBACK_PHONE).trim();
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
const resolveWelcomeWhatsAppPreferredInstance = () => {
    const fromEnv = String(process.env.WABA_WELCOME_WHATSAPP_EVO_INSTANCE || "").trim();
    if (fromEnv)
        return fromEnv;
    const pushConfig = new waba_push_repository_1.WabaPushRepository().readConfig();
    const fromPush = String(pushConfig.communityEvoInstance || "").trim();
    if (fromPush)
        return fromPush;
    return (0, waba_push_types_1.resolveDefaultPushCommunityEvoInstance)();
};
const resolveWelcomeCommunityLink = () => {
    const fromEnv = String(process.env.WABA_WELCOME_COMMUNITY_LINK || "").trim();
    if (fromEnv)
        return fromEnv;
    const fromPush = String(new waba_push_repository_1.WabaPushRepository().readConfig().communityInviteLink || "").trim();
    return fromPush || DEFAULT_COMMUNITY_LINK;
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
const buildWelcomeSendCandidates = async () => {
    const primaryPhone = resolveWelcomePrimaryPhoneHint();
    const fallbackPhone = resolveWelcomeFallbackPhoneHint();
    const primaryByPhone = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(primaryPhone);
    if (primaryByPhone) {
        console.info(`[whatsapp] boas-vindas: instância primária ${primaryByPhone} (${primaryPhone}) conectada.`);
        return [primaryByPhone];
    }
    const fallbackByPhone = await (0, waba_push_community_service_1.resolveConnectedEvoInstanceByPhoneHint)(fallbackPhone);
    if (fallbackByPhone) {
        console.info(`[whatsapp] boas-vindas: primária ${primaryPhone} indisponível; usando ${fallbackByPhone} (${fallbackPhone}).`);
        return [fallbackByPhone];
    }
    console.warn(`[whatsapp] boas-vindas: instâncias ${primaryPhone} e ${fallbackPhone} indisponíveis; tentando resolução legada.`);
    const preferred = resolveWelcomeWhatsAppPreferredInstance();
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
const buildSubscriberWelcomeWhatsAppText = (input) => {
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password ?? "");
    const loginUrl = String(input.loginUrl || (0, waba_app_url_1.resolveWabaAppLoginUrl)()).trim() || (0, waba_app_url_1.resolveWabaAppLoginUrl)();
    const communityLink = String(input.communityLink || resolveWelcomeCommunityLink()).trim();
    return [
        "🎉 Seja muito bem-vindo(a) à família DRAX!",
        "",
        "É uma satisfação ter você conosco. A partir de agora, você terá acesso à nossa plataforma e a uma equipe comprometida em oferecer a melhor experiência possível.",
        "",
        "🔐 Seus dados de acesso:",
        "",
        "━━━━━━━━━━━━━━━━━━",
        `📧 E-mail: ${email}`,
        `🔑 Senha: ${password}`,
        `🌐 Sistema: ${loginUrl}`,
        "━━━━━━━━━━━━━━━━━━",
        "",
        "📢 Entre na nossa Comunidade Oficial no WhatsApp",
        "",
        "É por lá que compartilhamos:",
        "✅ Atualizações e novas funcionalidades;",
        "✅ Avisos importantes;",
        "✅ Melhorias da plataforma;",
        "✅ Comunicados oficiais da DRAX.",
        "",
        `👉 ${communityLink}`,
        "",
        "💚 Recomendamos que você entre na comunidade agora para ficar sempre por dentro das novidades.",
        "",
        "Mais uma vez, seja muito bem-vindo(a)! Temos certeza de que a DRAX será uma grande parceira no crescimento do seu negócio.",
        "",
        "Equipe DRAX Sistemas 🚀",
    ].join("\n");
};
exports.buildSubscriberWelcomeWhatsAppText = buildSubscriberWelcomeWhatsAppText;
const deliverSubscriberWelcomeWhatsApp = async (input) => {
    const whatsapp = String(input.whatsapp || "").replace(/\D/g, "");
    const email = String(input.email || "").trim().toLowerCase();
    if (!whatsapp || whatsapp.length < 10) {
        return {
            status: "skipped",
            message: `boas-vindas WhatsApp ${email}: número do assinante inválido.`,
        };
    }
    const text = (0, exports.buildSubscriberWelcomeWhatsAppText)(input);
    const candidates = await buildWelcomeSendCandidates();
    if (!candidates.length) {
        return {
            status: "skipped",
            message: `boas-vindas WhatsApp ${email}: nenhuma instância Evolution disponível.`,
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
            console.log(`[whatsapp] boas-vindas enviada para ${whatsapp} (${email}) via ${instanceName}.`);
            return { status: "sent", message: "WhatsApp enviado.", instanceName };
        }
        const detail = String(result.detail || "Falha no envio via Evolution.").slice(0, 300);
        errors.push(`${instanceName}: ${detail}`);
        console.warn(`[whatsapp] boas-vindas tentativa falhou (${instanceName}) para ${whatsapp} (${email}):`, detail);
        if (!isRecoverableSendFailure(detail, result.status))
            break;
    }
    const message = errors.join(" | ") || `boas-vindas WhatsApp ${email}: falha desconhecida.`;
    console.error(`[whatsapp] boas-vindas falhou para ${whatsapp} (${email}):`, message);
    return { status: "failed", message };
};
exports.deliverSubscriberWelcomeWhatsApp = deliverSubscriberWelcomeWhatsApp;
const notifySubscriberWelcomeWhatsApp = (input) => {
    void (0, exports.deliverSubscriberWelcomeWhatsApp)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[whatsapp] boas-vindas cadastro (async):", message);
    });
};
exports.notifySubscriberWelcomeWhatsApp = notifySubscriberWelcomeWhatsApp;
