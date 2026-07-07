"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOperacionalStaffOnCampaignCreated = void 0;
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
const notifyOperacionalStaffOnCampaignCreated = async (intake) => {
    const attemptedAt = new Date().toISOString();
    const apiKind = resolveApiKind(intake);
    const apiKindLabel = waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind];
    const subscriber = new waba_subscriber_repository_1.WabaSubscriberRepository().getByEmail(intake.ownerEmail);
    const subscriberSegment = subscriber?.segment ?? "outros";
    const operacionais = new waba_system_user_service_1.WabaSystemUserService().listOperacionalUsersForCampaign(apiKind, subscriberSegment);
    if (!operacionais.length) {
        const message = `Nenhum usuário operacional designado para ${apiKindLabel} no segmento ` +
            `${subscriberSegment === "bets" ? "Bets" : "Outros"}. ` +
            "Configure em Admin · Usuários o plano de atendimento e o segmento.";
        console.warn(`[mail] campanha ${intake.id}: ${message}`);
        return {
            attemptedAt,
            apiKind,
            apiKindLabel,
            recipients: [],
        };
    }
    const subscriberId = String(subscriber?.id ?? "").trim() || "—";
    const createdAtLabel = formatCreatedAtLabel(intake.createdAt);
    const plannedSendCount = resolvePlannedSendCount(intake);
    console.log(`[mail] campanha ${intake.id} (${apiKindLabel}): notificando ${operacionais.length} operacional(is): ` +
        operacionais.map((user) => user.email).join(", "));
    const recipients = [];
    for (const operacional of operacionais) {
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
        const whatsappDelivery = await (0, waba_operacional_campaign_whatsapp_service_1.deliverOperacionalNewCampaignWhatsApp)({
            recipientEmail: operacional.email,
            recipientName: operacional.fullName,
            whatsapp: String(operacional.whatsapp ?? "").trim(),
            campaignId: intake.id,
            campaignName: intake.campaignName,
            subscriberId,
            plannedSendCount,
            createdAtLabel,
            apiKindLabel,
            campaignUrl: "",
        });
        const aggregatedStatus = emailDelivery.status === "sent" || whatsappDelivery.status === "sent"
            ? "sent"
            : emailDelivery.status === "failed" || whatsappDelivery.status === "failed"
                ? "failed"
                : "skipped";
        const aggregatedMessage = [
            `E-mail: ${emailDelivery.message}`,
            `WhatsApp: ${whatsappDelivery.message}`,
        ].join(" | ");
        recipients.push({
            email: operacional.email.trim().toLowerCase(),
            fullName: operacional.fullName,
            status: aggregatedStatus,
            message: aggregatedMessage,
            messageId: emailDelivery.messageId,
            emailStatus: emailDelivery.status,
            emailMessage: emailDelivery.message,
            emailMessageId: emailDelivery.messageId,
            whatsapp: String(operacional.whatsapp ?? "").trim(),
            whatsappStatus: whatsappDelivery.status,
            whatsappMessage: whatsappDelivery.message,
            whatsappInstanceName: whatsappDelivery.instanceName,
        });
        if (aggregatedStatus === "skipped") {
            console.warn(`[notify] ${operacional.email}: ${aggregatedMessage}`);
        }
        else if (aggregatedStatus === "failed") {
            console.error(`[notify] operacional nova campanha: ${operacional.email}: ${aggregatedMessage}`);
        }
    }
    return {
        attemptedAt,
        apiKind,
        apiKindLabel,
        recipients,
    };
};
exports.notifyOperacionalStaffOnCampaignCreated = notifyOperacionalStaffOnCampaignCreated;
