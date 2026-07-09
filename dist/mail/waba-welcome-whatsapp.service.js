"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyStaffWelcomeWhatsApp = exports.notifySubscriberWelcomeWhatsApp = exports.deliverStaffWelcomeWhatsApp = exports.deliverSubscriberWelcomeWhatsApp = exports.buildStaffWelcomeWhatsAppText = exports.buildSubscriberWelcomeWhatsAppText = void 0;
const waba_evolution_whatsapp_delivery_service_1 = require("./waba-evolution-whatsapp-delivery.service");
const waba_push_repository_1 = require("../push/waba-push.repository");
const waba_app_url_1 = require("./waba-app-url");
const DEFAULT_COMMUNITY_LINK = "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7";
const resolveWelcomeCommunityLink = () => {
    const fromEnv = String(process.env.WABA_WELCOME_COMMUNITY_LINK || "").trim();
    if (fromEnv)
        return fromEnv;
    const fromPush = String(new waba_push_repository_1.WabaPushRepository().readConfig().communityInviteLink || "").trim();
    return fromPush || DEFAULT_COMMUNITY_LINK;
};
const buildSubscriberWelcomeWhatsAppText = (input) => {
    const email = String(input.email || "").trim().toLowerCase();
    const passwordPlain = String(input.password ?? "").trim();
    const passwordLine = passwordPlain
        ? `🔑 Senha: ${passwordPlain}`
        : "🔑 Senha: a definida no seu cadastro (use Esqueci a senha se necessário)";
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
        passwordLine,
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
const buildStaffWelcomeWhatsAppText = (input) => {
    const email = String(input.email || "").trim().toLowerCase();
    const passwordPlain = String(input.password ?? "").trim();
    const passwordLine = passwordPlain
        ? `🔑 Senha: ${passwordPlain}`
        : "🔑 Senha: a definida no seu cadastro (use Esqueci a senha se necessário)";
    const loginUrl = String(input.loginUrl || (0, waba_app_url_1.resolveWabaAppLoginUrl)()).trim() || (0, waba_app_url_1.resolveWabaAppLoginUrl)();
    const roleLabel = String(input.roleLabel || "").trim() || "Equipe";
    const recipientName = String(input.fullName || "").trim();
    const operacionalApiLabel = String(input.operacionalDispatchesApiLabel || "").trim();
    const operacionalSegmentLabel = String(input.operacionalSegmentLabel || "").trim();
    const operacionalBlock = operacionalApiLabel || operacionalSegmentLabel
        ? [
            "",
            "📋 Atendimento:",
            operacionalApiLabel ? `• Disparos: ${operacionalApiLabel}` : "",
            operacionalSegmentLabel ? `• Segmento: ${operacionalSegmentLabel}` : "",
        ]
            .filter(Boolean)
            .join("\n")
        : "";
    return [
        recipientName ? `Olá, ${recipientName}!` : "Olá!",
        "",
        `🎉 Bem-vindo(a) à equipe DRAX como usuário ${roleLabel}.`,
        "",
        "Seu acesso ao painel WABA já está liberado com os menus configurados para sua função.",
        "",
        "🔐 Seus dados de acesso:",
        "",
        "━━━━━━━━━━━━━━━━━━",
        `📧 E-mail: ${email}`,
        passwordLine,
        `🌐 Sistema: ${loginUrl}`,
        "━━━━━━━━━━━━━━━━━━",
        operacionalBlock,
        "",
        "Qualquer dúvida, fale com o administrador master da sua conta.",
        "",
        "Equipe DRAX Sistemas 🚀",
    ]
        .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
        .join("\n");
};
exports.buildStaffWelcomeWhatsAppText = buildStaffWelcomeWhatsAppText;
const deliverWelcomeWhatsAppMessage = async (input) => {
    return (0, waba_evolution_whatsapp_delivery_service_1.deliverWabaEvolutionWhatsApp)({
        targetWhatsapp: input.whatsapp,
        recipientEmail: input.email,
        text: input.text,
        logLabel: input.logLabel || "boas-vindas",
    });
};
const deliverSubscriberWelcomeWhatsApp = async (input) => {
    const email = String(input.email || "").trim().toLowerCase();
    const text = (0, exports.buildSubscriberWelcomeWhatsAppText)(input);
    return deliverWelcomeWhatsAppMessage({
        email,
        whatsapp: input.whatsapp,
        text,
        logLabel: "boas-vindas",
    });
};
exports.deliverSubscriberWelcomeWhatsApp = deliverSubscriberWelcomeWhatsApp;
const deliverStaffWelcomeWhatsApp = async (input) => {
    const email = String(input.email || "").trim().toLowerCase();
    const text = (0, exports.buildStaffWelcomeWhatsAppText)(input);
    return deliverWelcomeWhatsAppMessage({
        email,
        whatsapp: input.whatsapp,
        text,
        logLabel: "boas-vindas equipe",
    });
};
exports.deliverStaffWelcomeWhatsApp = deliverStaffWelcomeWhatsApp;
const notifySubscriberWelcomeWhatsApp = (input) => {
    void (0, exports.deliverSubscriberWelcomeWhatsApp)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[whatsapp] boas-vindas cadastro (async):", message);
    });
};
exports.notifySubscriberWelcomeWhatsApp = notifySubscriberWelcomeWhatsApp;
const notifyStaffWelcomeWhatsApp = (input) => {
    void (0, exports.deliverStaffWelcomeWhatsApp)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[whatsapp] boas-vindas equipe (async):", message);
    });
};
exports.notifyStaffWelcomeWhatsApp = notifyStaffWelcomeWhatsApp;
