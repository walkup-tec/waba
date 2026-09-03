"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudBroadcastProgress = cloudBroadcastProgress;
exports.cloudBroadcastDisplayStatus = cloudBroadcastDisplayStatus;
exports.toCloudBroadcastHistoryItem = toCloudBroadcastHistoryItem;
const waba_campaign_intake_status_1 = require("../../disparos/waba-campaign-intake-status");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
function cloudBroadcastProgress(input) {
    const requested = Math.max(0, Math.round(Number(input.plannedSendCount || input.total || 0)));
    const processed = Math.max(0, Math.round(Number(input.sent || 0) + Number(input.failed || 0)));
    if (!requested)
        return { processed, requested: 0, percent: 0 };
    const status = String(input.status || "");
    if (status === "done" || status === "completed") {
        return { processed: Math.max(processed, requested), requested, percent: 100 };
    }
    return {
        processed: Math.min(processed, requested),
        requested,
        percent: Math.min(100, Math.round((processed / requested) * 100)),
    };
}
function cloudBroadcastDisplayStatus(input) {
    if (input.voided)
        return { key: "cancelled", label: "Cancelado" };
    const intake = input.intakeStatus ? (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(input.intakeStatus) : "";
    if (intake === "completed")
        return { key: "completed", label: "Finalizado" };
    if (intake === "error_reported")
        return { key: "error", label: "Erro reportado" };
    if (intake === "cancelled")
        return { key: "cancelled", label: "Cancelada" };
    const broadcast = String(input.broadcastStatus || "");
    if (broadcast === "queued")
        return { key: "queued", label: "Na fila" };
    if (broadcast === "running")
        return { key: "running", label: "Enviando" };
    if (broadcast === "failed")
        return { key: "failed", label: "Falha no envio" };
    if (broadcast === "done" && intake === "in_progress") {
        return { key: "collecting", label: "Coletando relatório da Meta" };
    }
    if (broadcast === "done")
        return { key: "done", label: "Envio concluído" };
    if (intake === "in_progress")
        return { key: "in_progress", label: "Em andamento" };
    return { key: "unknown", label: "Em andamento" };
}
function toCloudBroadcastHistoryItem(input) {
    const requested = Math.max(0, Math.round(Number(input.plannedSendCount || input.campaign.total || 0)));
    const progress = cloudBroadcastProgress({
        sent: input.campaign.sent,
        failed: input.campaign.failed,
        total: input.campaign.total,
        plannedSendCount: requested,
        status: input.campaign.status,
    });
    const display = cloudBroadcastDisplayStatus({
        broadcastStatus: input.campaign.status,
        intakeStatus: input.intakeStatus,
        voided: Boolean(String(input.campaign.voidedAt || "").trim()),
    });
    return {
        ...(0, meta_whatsapp_broadcast_store_1.publicBroadcastCampaign)(input.campaign),
        startedAt: input.campaign.createdAt,
        campaignName: String(input.campaignName || input.campaign.templateName || "Campanha").trim() || "Campanha",
        clientName: String(input.clientName || "").trim() || "Assinante",
        plannedSendCount: requested,
        processedCount: progress.processed,
        progressPercent: progress.percent,
        statusKey: display.key,
        statusLabel: display.label,
    };
}
