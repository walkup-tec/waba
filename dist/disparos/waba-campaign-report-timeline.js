"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIBER_REPORT_TIMELINE_DEFS = exports.META_REPORT_COLLECTION_NOTE = void 0;
exports.formatCampaignReportDateTime = formatCampaignReportDateTime;
exports.firstNonEmptyIso = firstNonEmptyIso;
exports.resolveDispatchStartedAt = resolveDispatchStartedAt;
exports.buildSubscriberCampaignTimeline = buildSubscriberCampaignTimeline;
exports.collectIntakeReportTimeline = collectIntakeReportTimeline;
const meta_whatsapp_broadcast_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-broadcast.store");
const meta_whatsapp_template_approved_at_store_1 = require("../integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store");
exports.META_REPORT_COLLECTION_NOTE = "A Meta pode demorar até 3 horas após o fim do disparo para finalizar a coleta e a exibição dos dados deste relatório.";
exports.SUBSCRIBER_REPORT_TIMELINE_DEFS = [
    { key: "createdAt", label: "Criação da Campanha" },
    { key: "attendanceStartedAt", label: "Início do Atendimento" },
    { key: "templateApprovedAt", label: "Aprovação Template" },
    { key: "dispatchStartedAt", label: "Início do disparo" },
    { key: "dispatchFinishedAt", label: "Fim do disparo" },
];
const TIMEZONE = "America/Sao_Paulo";
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
    const started = firstNonEmptyIso(input.sendStartedAt);
    if (started)
        return started;
    const status = String(input.status || "").trim();
    if (!status || status === "queued")
        return null;
    return firstNonEmptyIso(input.createdAt);
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
        items: exports.SUBSCRIBER_REPORT_TIMELINE_DEFS.map((def) => ({
            key: def.key,
            label: def.label,
            at: values[def.key],
            display: formatCampaignReportDateTime(values[def.key]),
        })),
        metaCollectionNote: exports.META_REPORT_COLLECTION_NOTE,
    };
}
function collectIntakeReportTimeline(intake) {
    const broadcast = (0, meta_whatsapp_broadcast_store_1.findBroadcastByIntakeCampaignId)(intake.id);
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
        createdAt: intake.createdAt,
        attendanceStartedAt: intake.startedAt,
        templateApprovedAt,
        dispatchStartedAt: resolveDispatchStartedAt(broadcast),
        dispatchFinishedAt: broadcast?.sendFinishedAt || null,
    });
}
