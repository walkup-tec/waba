"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOperacionalStaffOnCampaignCreated = exports.notifyOperacionalStaffOnCampaignAssigned = void 0;
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_mail_delivery_1 = require("./waba-mail-delivery");
const waba_operacional_campaign_whatsapp_service_1 = require("./waba-operacional-campaign-whatsapp.service");
const formatCreatedAtLabel = (iso) => {
    const value = String(iso ?? "").trim();
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};
const resolvePlannedSendCount = (intake) => {
    const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
    if (planned > 0)
        return planned;
    return Math.max(0, Math.round(Number(intake.importedLineCount ?? 0)));
};
const resolveApiKind = (intake) => (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
const buildSkippedRecipient = (input) => ({
    role: input.role,
    email: String(input.user.email || "").trim().toLowerCase(),
    fullName: String(input.user.fullName || "").trim(),
    status: "skipped",
    message: input.message,
    emailStatus: "skipped",
    emailMessage: input.role === "master" ? "E-mail não enviado para master." : input.message,
    whatsapp: String(input.user.whatsapp ?? "").trim(),
    whatsappStatus: "skipped",
    whatsappMessage: input.message,
});
const notifyAssignedOperacionalAndMasters = async (intake) => {
    const attemptedAt = new Date().toISOString();
    const apiKind = resolveApiKind(intake);
    const apiKindLabel = waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind];
    const assignedEmail = String(intake.assignedOperacionalEmail || "").trim().toLowerCase();
    if (!assignedEmail) {
        console.warn(`[mail] campanha ${intake.id}: sem operacional atribuído — notificação de campanha ignorada.`);
        return {
            attemptedAt,
            apiKind,
            apiKindLabel,
            recipients: [],
        };
    }
    const userService = new waba_system_user_service_1.WabaSystemUserService();
    const operacional = userService.getByEmail(assignedEmail);
    if (!operacional || operacional.role !== "operacional") {
        console.warn(`[mail] campanha ${intake.id}: operacional atribuído inválido (${assignedEmail}).`);
        return {
            attemptedAt,
            apiKind,
            apiKindLabel,
            recipients: [],
        };
    }
    const subscriber = new waba_subscriber_repository_1.WabaSubscriberRepository().getByEmail(intake.ownerEmail);
    const subscriberId = String(subscriber?.id ?? "").trim() || "—";
    const createdAtLabel = formatCreatedAtLabel(intake.createdAt);
    const plannedSendCount = resolvePlannedSendCount(intake);
    const assignedOperacionalName = String(operacional.fullName || "").trim() || assignedEmail;
    const templateBase = {
        campaignId: intake.id,
        campaignName: intake.campaignName,
        subscriberId,
        plannedSendCount,
        createdAtLabel,
        createdAtIso: intake.createdAt,
        assignedOperacionalName,
        apiKindLabel,
        campaignUrl: "",
    };
    const recipients = [];
    const emailDelivery = await (0, waba_mail_delivery_1.deliverOperacionalNewCampaignEmail)({
        operacionalEmail: operacional.email,
        operacionalName: operacional.fullName,
        campaignId: intake.id,
        campaignName: intake.campaignName,
        subscriberId,
        plannedSendCount,
        createdAtLabel,
        apiKindLabel,
    });
    const operacionalWhatsappDelivery = await (0, waba_operacional_campaign_whatsapp_service_1.deliverOperacionalNewCampaignWhatsApp)({
        recipientEmail: operacional.email,
        recipientName: operacional.fullName,
        whatsapp: String(operacional.whatsapp ?? "").trim(),
        ...templateBase,
    });
    const operacionalAggregatedStatus = emailDelivery.status === "sent" || operacionalWhatsappDelivery.status === "sent"
        ? "sent"
        : emailDelivery.status === "failed" || operacionalWhatsappDelivery.status === "failed"
            ? "failed"
            : "skipped";
    recipients.push({
        role: "operacional",
        email: operacional.email.trim().toLowerCase(),
        fullName: operacional.fullName,
        status: operacionalAggregatedStatus,
        message: [
            `E-mail: ${emailDelivery.message}`,
            `WhatsApp: ${operacionalWhatsappDelivery.message}`,
        ].join(" | "),
        messageId: emailDelivery.messageId,
        emailStatus: emailDelivery.status,
        emailMessage: emailDelivery.message,
        emailMessageId: emailDelivery.messageId,
        whatsapp: String(operacional.whatsapp ?? "").trim(),
        whatsappStatus: operacionalWhatsappDelivery.status,
        whatsappMessage: operacionalWhatsappDelivery.message,
        whatsappInstanceName: operacionalWhatsappDelivery.instanceName,
    });
    const masters = userService.listMasterUsers();
    console.log(`[mail] campanha ${intake.id} (${apiKindLabel}): WhatsApp para operacional ${assignedEmail} e ${masters.length} master(s).`);
    for (const master of masters) {
        const masterWhatsapp = String(master.whatsapp ?? "").trim();
        if (!masterWhatsapp.replace(/\D/g, "") || masterWhatsapp.replace(/\D/g, "").length < 10) {
            recipients.push(buildSkippedRecipient({
                role: "master",
                user: master,
                message: "WhatsApp master inválido ou ausente.",
            }));
            continue;
        }
        const masterWhatsappDelivery = await (0, waba_operacional_campaign_whatsapp_service_1.deliverOperacionalNewCampaignWhatsApp)({
            recipientEmail: master.email,
            recipientName: master.fullName,
            whatsapp: masterWhatsapp,
            ...templateBase,
        });
        const masterStatus = masterWhatsappDelivery.status === "sent"
            ? "sent"
            : masterWhatsappDelivery.status === "failed"
                ? "failed"
                : "skipped";
        recipients.push({
            role: "master",
            email: master.email.trim().toLowerCase(),
            fullName: master.fullName,
            status: masterStatus,
            message: `WhatsApp: ${masterWhatsappDelivery.message}`,
            emailStatus: "skipped",
            emailMessage: "E-mail não enviado para master.",
            whatsapp: masterWhatsapp,
            whatsappStatus: masterWhatsappDelivery.status,
            whatsappMessage: masterWhatsappDelivery.message,
            whatsappInstanceName: masterWhatsappDelivery.instanceName,
        });
    }
    return {
        attemptedAt,
        apiKind,
        apiKindLabel,
        recipients,
    };
};
const notifyOperacionalStaffOnCampaignAssigned = async (intake) => notifyAssignedOperacionalAndMasters(intake);
exports.notifyOperacionalStaffOnCampaignAssigned = notifyOperacionalStaffOnCampaignAssigned;
const notifyOperacionalStaffOnCampaignCreated = async (intake) => notifyAssignedOperacionalAndMasters(intake);
exports.notifyOperacionalStaffOnCampaignCreated = notifyOperacionalStaffOnCampaignCreated;
