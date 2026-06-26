"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySubscriberWelcomeEmail = exports.notifyOperacionalNewCampaignEmail = exports.deliverOperacionalNewCampaignEmail = exports.notifyCampaignErrorReportedEmail = exports.notifyCampaignCompletedEmail = exports.notifySupportTicketClosedEmail = exports.deliverSubscriberWelcomeEmail = exports.deliverCampaignErrorReportedEmail = exports.deliverCampaignCompletedEmail = exports.deliverSupportTicketClosedEmail = void 0;
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_app_url_1 = require("./waba-app-url");
const waba_mail_templates_1 = require("./waba-mail.templates");
const waba_mail_service_1 = require("./waba-mail.service");
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
const resolveSubscriberName = (email) => {
    const subscriber = subscriberRepository.getByEmail(email);
    return String(subscriber?.fullName || "").trim();
};
const deliverEmail = async (input) => {
    const toEmail = String(input.toEmail || "")
        .trim()
        .toLowerCase();
    if (!toEmail.includes("@")) {
        return { status: "skipped", message: `${input.logLabel}: destinatário sem e-mail válido.` };
    }
    if (!waba_mail_service_1.wabaMailService.isConfigured()) {
        return {
            status: "skipped",
            message: `${input.logLabel}: SMTP não configurado (MAIL_MODE=smtp, SMTP_*).`,
        };
    }
    try {
        const delivery = await waba_mail_service_1.wabaMailService.send({
            to: toEmail,
            subject: input.subject,
            html: input.html,
        });
        console.log(`[mail] ${input.logLabel} enviado para ${toEmail} (${delivery.messageId || "ok"}).`);
        return {
            status: "sent",
            message: "E-mail enviado.",
            messageId: delivery.messageId,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao enviar e-mail.";
        console.error(`[mail] ${input.logLabel} falhou para ${toEmail}:`, message);
        return { status: "failed", message };
    }
};
const deliverSupportTicketClosedEmail = async (input) => {
    const ownerEmail = String(input.ownerEmail || "")
        .trim()
        .toLowerCase();
    const ownerName = String(input.ownerName || "").trim() || resolveSubscriberName(ownerEmail);
    const mail = (0, waba_mail_templates_1.buildSupportTicketClosedTemplate)({
        recipientName: ownerName,
        recipientEmail: ownerEmail,
        displayId: input.displayId,
        ticketTitle: input.ticketTitle,
        masterResponse: input.masterResponse,
    });
    return deliverEmail({
        toEmail: ownerEmail,
        subject: mail.subject,
        html: mail.html,
        logLabel: `chamado ${input.displayId || input.ownerEmail}`,
    });
};
exports.deliverSupportTicketClosedEmail = deliverSupportTicketClosedEmail;
const deliverCampaignCompletedEmail = async (input) => {
    const ownerEmail = String(input.ownerEmail || "")
        .trim()
        .toLowerCase();
    const ownerName = resolveSubscriberName(ownerEmail);
    const reportUrl = (0, waba_app_url_1.buildCampaignReportDeepLink)(input.campaignId);
    const mail = (0, waba_mail_templates_1.buildCampaignCompletedTemplate)({
        recipientName: ownerName,
        recipientEmail: ownerEmail,
        campaignName: input.campaignName,
        reportUrl,
    });
    return deliverEmail({
        toEmail: ownerEmail,
        subject: mail.subject,
        html: mail.html,
        logLabel: `campanha ${input.campaignId}`,
    });
};
exports.deliverCampaignCompletedEmail = deliverCampaignCompletedEmail;
const deliverCampaignErrorReportedEmail = async (input) => {
    const ownerEmail = String(input.ownerEmail || "")
        .trim()
        .toLowerCase();
    const ownerName = resolveSubscriberName(ownerEmail);
    const campaignsUrl = (0, waba_app_url_1.buildCampaignListDeepLink)();
    const mail = (0, waba_mail_templates_1.buildCampaignErrorReportedTemplate)({
        recipientName: ownerName,
        recipientEmail: ownerEmail,
        campaignName: input.campaignName,
        campaignsUrl,
    });
    return deliverEmail({
        toEmail: ownerEmail,
        subject: mail.subject,
        html: mail.html,
        logLabel: `campanha erro ${input.campaignId}`,
    });
};
exports.deliverCampaignErrorReportedEmail = deliverCampaignErrorReportedEmail;
const deliverSubscriberWelcomeEmail = async (input) => {
    const email = String(input.email || "")
        .trim()
        .toLowerCase();
    const loginUrl = String(input.loginUrl || (0, waba_app_url_1.resolveWabaAppLoginUrl)()).trim() || (0, waba_app_url_1.resolveWabaAppLoginUrl)();
    const mail = (0, waba_mail_templates_1.buildSubscriberWelcomeTemplate)({
        recipientName: input.fullName,
        recipientEmail: email,
        whatsapp: input.whatsapp,
        phone: input.phone,
        cpfCnpj: input.cpfCnpj,
        loginUrl,
    });
    return deliverEmail({
        toEmail: email,
        subject: mail.subject,
        html: mail.html,
        logLabel: `boas-vindas ${email}`,
    });
};
exports.deliverSubscriberWelcomeEmail = deliverSubscriberWelcomeEmail;
const notifySupportTicketClosedEmail = (input) => {
    void (0, exports.deliverSupportTicketClosedEmail)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[mail] chamado finalizado (async):", message);
    });
};
exports.notifySupportTicketClosedEmail = notifySupportTicketClosedEmail;
const notifyCampaignCompletedEmail = (input) => {
    void (0, exports.deliverCampaignCompletedEmail)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[mail] campanha finalizada (async):", message);
    });
};
exports.notifyCampaignCompletedEmail = notifyCampaignCompletedEmail;
const notifyCampaignErrorReportedEmail = (input) => {
    void (0, exports.deliverCampaignErrorReportedEmail)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[mail] campanha erro reportado (async):", message);
    });
};
exports.notifyCampaignErrorReportedEmail = notifyCampaignErrorReportedEmail;
const deliverOperacionalNewCampaignEmail = async (input) => {
    const operacionalEmail = String(input.operacionalEmail || "")
        .trim()
        .toLowerCase();
    const operacionalName = String(input.operacionalName || "").trim();
    const campaignUrl = (0, waba_app_url_1.buildOperacionalAdminCampaignDeepLink)(input.campaignId);
    const mail = (0, waba_mail_templates_1.buildOperacionalNewCampaignTemplate)({
        recipientName: operacionalName,
        recipientEmail: operacionalEmail,
        campaignId: input.campaignId,
        campaignName: input.campaignName,
        subscriberId: input.subscriberId,
        plannedSendCount: input.plannedSendCount,
        createdAtLabel: input.createdAtLabel,
        apiKindLabel: input.apiKindLabel,
        campaignUrl,
    });
    return deliverEmail({
        toEmail: operacionalEmail,
        subject: mail.subject,
        html: mail.html,
        logLabel: `operacional nova campanha ${input.campaignId}`,
    });
};
exports.deliverOperacionalNewCampaignEmail = deliverOperacionalNewCampaignEmail;
const notifyOperacionalNewCampaignEmail = (input) => {
    void (0, exports.deliverOperacionalNewCampaignEmail)(input)
        .then((result) => {
        if (result.status === "skipped") {
            console.warn(`[mail] ${result.message}`);
        }
        else if (result.status === "failed") {
            console.error(`[mail] operacional nova campanha (async): ${result.message}`);
        }
    })
        .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[mail] operacional nova campanha (async):", message);
    });
};
exports.notifyOperacionalNewCampaignEmail = notifyOperacionalNewCampaignEmail;
const notifySubscriberWelcomeEmail = (input) => {
    void (0, exports.deliverSubscriberWelcomeEmail)(input).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[mail] boas-vindas cadastro (async):", message);
    });
};
exports.notifySubscriberWelcomeEmail = notifySubscriberWelcomeEmail;
