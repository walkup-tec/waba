"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOperacionalStaffOnCampaignCreated = void 0;
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_mail_delivery_1 = require("./waba-mail-delivery");
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
const notifyOperacionalStaffOnCampaignCreated = (intake) => {
    setImmediate(() => {
        void notifyOperacionalStaffOnCampaignCreatedAsync(intake).catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[mail] campanha ${intake.id}: falha ao notificar operacional:`, message);
        });
    });
};
exports.notifyOperacionalStaffOnCampaignCreated = notifyOperacionalStaffOnCampaignCreated;
const notifyOperacionalStaffOnCampaignCreatedAsync = async (intake) => {
    const apiKind = resolveApiKind(intake);
    const operacionais = new waba_system_user_service_1.WabaSystemUserService().listOperacionalUsersForDispatchesApi(apiKind);
    if (!operacionais.length) {
        console.warn(`[mail] campanha ${intake.id}: nenhum usuário operacional designado para ${apiKind}. ` +
            "Verifique Admin · Usuários → operacionalDispatchesApi.");
        return;
    }
    const subscriber = new waba_subscriber_repository_1.WabaSubscriberRepository().getByEmail(intake.ownerEmail);
    const subscriberId = String(subscriber?.id ?? "").trim() || "—";
    const createdAtLabel = formatCreatedAtLabel(intake.createdAt);
    const plannedSendCount = resolvePlannedSendCount(intake);
    const apiKindLabel = waba_dispatches_api_kind_1.WABA_DISPATCHES_API_LABELS[apiKind];
    console.log(`[mail] campanha ${intake.id} (${apiKindLabel}): notificando ${operacionais.length} operacional(is): ` +
        operacionais.map((user) => user.email).join(", "));
    const results = await Promise.all(operacionais.map((operacional) => (0, waba_mail_delivery_1.deliverOperacionalNewCampaignEmail)({
        operacionalEmail: operacional.email,
        operacionalName: operacional.fullName,
        campaignId: intake.id,
        campaignName: intake.campaignName,
        subscriberId,
        plannedSendCount,
        createdAtLabel,
        apiKindLabel,
    })));
    for (const result of results) {
        if (result.status === "skipped") {
            console.warn(`[mail] ${result.message}`);
        }
        else if (result.status === "failed") {
            console.error(`[mail] operacional nova campanha: ${result.message}`);
        }
    }
};
