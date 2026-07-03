"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySubscriberWelcomeWhatsApp = exports.deliverSubscriberWelcomeWhatsApp = exports.buildSubscriberWelcomeWhatsAppText = void 0;
const evo_text_alert_client_1 = require("../monitoring/evo-text-alert.client");
const waba_push_repository_1 = require("../push/waba-push.repository");
const waba_push_types_1 = require("../push/waba-push.types");
const waba_app_url_1 = require("./waba-app-url");
const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";
const resolveWelcomeWhatsAppEvoInstance = () => {
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
    const instanceName = resolveWelcomeWhatsAppEvoInstance();
    if (!instanceName) {
        return {
            status: "skipped",
            message: `boas-vindas WhatsApp ${email}: instância Evolution não configurada.`,
        };
    }
    const text = (0, exports.buildSubscriberWelcomeWhatsAppText)(input);
    const result = await (0, evo_text_alert_client_1.sendEvoTextAlert)({
        instanceName,
        targetNumber: whatsapp,
        text,
    });
    if (result.ok) {
        console.log(`[whatsapp] boas-vindas enviada para ${whatsapp} (${email}) via ${instanceName}.`);
        return { status: "sent", message: "WhatsApp enviado." };
    }
    console.error(`[whatsapp] boas-vindas falhou para ${whatsapp} (${email}):`, result.detail);
    return { status: "failed", message: result.detail };
};
exports.deliverSubscriberWelcomeWhatsApp = deliverSubscriberWelcomeWhatsApp;
const notifySubscriberWelcomeWhatsApp = (input) => {
    void (0, exports.deliverSubscriberWelcomeWhatsApp)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[whatsapp] boas-vindas cadastro (async):", message);
    });
};
exports.notifySubscriberWelcomeWhatsApp = notifySubscriberWelcomeWhatsApp;
