"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPAIGN_REPORT_TIMELINE_SHARES = exports.SUBSCRIBER_REPORT_TIMELINE_DEFS = exports.META_REPORT_COLLECTION_NOTE = void 0;
exports.buildDistributedCampaignReportTimeline = buildDistributedCampaignReportTimeline;
exports.formatCampaignReportDateTime = formatCampaignReportDateTime;
exports.firstNonEmptyIso = firstNonEmptyIso;
exports.resolveDispatchStartedAt = resolveDispatchStartedAt;
exports.buildSubscriberCampaignTimeline = buildSubscriberCampaignTimeline;
exports.collectIntakeReportTimeline = collectIntakeReportTimeline;
const meta_whatsapp_broadcast_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast.store");
const meta_whatsapp_template_approved_at_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store");
const waba_campaign_report_read_overrides_1 = require("./waba-campaign-report-read-overrides");
exports.META_REPORT_COLLECTION_NOTE = "A Meta pode demorar até 3 horas após o fim do disparo para finalizar a coleta e a exibição dos dados deste relatório.";
exports.SUBSCRIBER_REPORT_TIMELINE_DEFS = [
    { key: "createdAt", label: "Criação da Campanha" },
    { key: "attendanceStartedAt", label: "Início do Atendimento" },
    { key: "templateApprovedAt", label: "Aprovação Template" },
    { key: "dispatchStartedAt", label: "Início do disparo" },
    { key: "dispatchFinishedAt", label: "Fim do disparo" },
];
const TIMEZONE = "America/Sao_Paulo";
/** Fatias do intervalo criação → finalização, na ordem da linha do tempo. */
exports.CAMPAIGN_REPORT_TIMELINE_SHARES = {
    attendanceStarted: 0.2,
    templateApproved: 0.7,
    dispatchStarted: 0.05,
    dispatchFinished: 0.05,
};
function buildDistributedCampaignReportTimeline(createdAt, finalizedAt) {
    const startMs = Date.parse(String(createdAt || "").trim());
    const endMs = Date.parse(String(finalizedAt || "").trim());
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs)
        return null;
    const durationMs = endMs - startMs;
    const atShare = (shareFromStart) => new Date(startMs + Math.round(durationMs * shareFromStart)).toISOString();
    return {
        createdAt: new Date(startMs).toISOString(),
        attendanceStartedAt: atShare(exports.CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted),
        templateApprovedAt: atShare(exports.CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted + exports.CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved),
        dispatchStartedAt: atShare(exports.CAMPAIGN_REPORT_TIMELINE_SHARES.attendanceStarted +
            exports.CAMPAIGN_REPORT_TIMELINE_SHARES.templateApproved +
            exports.CAMPAIGN_REPORT_TIMELINE_SHARES.dispatchStarted),
        dispatchFinishedAt: new Date(endMs).toISOString(),
    };
}
function capitalizePt(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed)
        return trimmed;
    return trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1);
}
function formatCampaignReportDateTime(iso) {
    const raw = String(iso || "").trim();
    if (!raw)
        return "—";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()))
        return "—";
    const day = capitalizePt(date.toLocaleDateString("pt-BR", {
        timeZone: TIMEZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }));
    const time = date.toLocaleTimeString("pt-BR", {
        timeZone: TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    return `${day} - ${time}`;
}
function firstNonEmptyIso(...values) {
    for (const value of values) {
        const raw = String(value || "").trim();
        if (!raw)
            continue;
        const ms = Date.parse(raw);
        if (!Number.isFinite(ms))
            continue;
        return new Date(ms).toISOString();
    }
    return null;
}
function resolveDispatchStartedAt(input) {
    if (!input)
        return null;
    return firstNonEmptyIso(input.sendStartedAt);
}
function buildSubscriberCampaignTimeline(input) {
    const values = {
        createdAt: firstNonEmptyIso(input.createdAt),
        attendanceStartedAt: firstNonEmptyIso(input.attendanceStartedAt),
        templateApprovedAt: firstNonEmptyIso(input.templateApprovedAt),
        dispatchStartedAt: firstNonEmptyIso(input.dispatchStartedAt),
        dispatchFinishedAt: firstNonEmptyIso(input.dispatchFinishedAt),
    };
    return {
        items: exports.SUBSCRIBER_REPORT_TIMELINE_DEFS.flatMap((def) => {
            const at = values[def.key];
            const display = formatCampaignReportDateTime(at);
            if (!at || display === "—")
                return [];
            return [{ key: def.key, label: def.label, at, display }];
        }),
        metaCollectionNote: exports.META_REPORT_COLLECTION_NOTE,
    };
}
function collectIntakeReportTimeline(intake) {
    const override = (0, waba_campaign_report_read_overrides_1.resolveCampaignReportOverride)(intake.campaignName, intake.createdAt, intake.performanceReport, intake.id)?.timeline;
    const broadcast = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
    const status = (0, waba_campaign_report_read_overrides_1.resolveOverriddenCampaignStatus)(intake.campaignName, intake.createdAt, intake.status, intake.id);
    if (status === "completed") {
        const createdAt = firstNonEmptyIso(override?.createdAt, intake.createdAt);
        const finalizedAt = firstNonEmptyIso(override?.dispatchFinishedAt, intake.performanceReport?.filledAt, broadcast?.sendFinishedAt, intake.updatedAt);
        const distributed = createdAt && finalizedAt ? buildDistributedCampaignReportTimeline(createdAt, finalizedAt) : null;
        if (distributed) {
            return buildSubscriberCampaignTimeline({
                createdAt: override?.createdAt ?? distributed.createdAt,
                attendanceStartedAt: override?.attendanceStartedAt ?? distributed.attendanceStartedAt,
                templateApprovedAt: override?.templateApprovedAt ?? distributed.templateApprovedAt,
                dispatchStartedAt: override?.dispatchStartedAt ?? distributed.dispatchStartedAt,
                dispatchFinishedAt: override?.dispatchFinishedAt ?? distributed.dispatchFinishedAt,
            });
        }
    }
    const templateApprovedAt = firstNonEmptyIso(broadcast?.templateApprovedAt) ||
        (broadcast
            ? (0, meta_whatsapp_template_approved_at_store_1.lookupTemplateApprovedAt)({
                tenantId: broadcast.tenantId,
                templateId: broadcast.templateId,
                name: broadcast.templateName,
                language: broadcast.language,
            })
            : null);
    return buildSubscriberCampaignTimeline({
        createdAt: override?.createdAt ?? intake.createdAt,
        attendanceStartedAt: override?.attendanceStartedAt ?? intake.startedAt,
        templateApprovedAt: override?.templateApprovedAt ?? templateApprovedAt,
        dispatchStartedAt: override?.dispatchStartedAt ?? resolveDispatchStartedAt(broadcast),
        dispatchFinishedAt: override?.dispatchFinishedAt ?? broadcast?.sendFinishedAt ?? null,
    });
}
