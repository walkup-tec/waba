"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCountCampaignIntakeCredits = exports.toCampaignIntakeDisplayStatus = exports.isCampaignIntakeFinalized = exports.normalizeCampaignIntakeStatus = void 0;
exports.campaignIntakeDisplayOptionsFromBroadcast = campaignIntakeDisplayOptionsFromBroadcast;
const normalizeCampaignIntakeStatus = (status) => {
    const raw = String(status || "").trim().toLowerCase();
    if (raw === "pending_review" || raw === "generated")
        return "generated";
    if (raw === "in_progress")
        return "in_progress";
    if (raw === "error_reported")
        return "error_reported";
    if (raw === "completed")
        return "completed";
    if (raw === "cancelled")
        return "cancelled";
    return "generated";
};
exports.normalizeCampaignIntakeStatus = normalizeCampaignIntakeStatus;
const isCampaignIntakeFinalized = (status) => {
    const normalized = (0, exports.normalizeCampaignIntakeStatus)(status);
    return normalized === "completed" || normalized === "error_reported";
};
exports.isCampaignIntakeFinalized = isCampaignIntakeFinalized;
function campaignIntakeDisplayOptionsFromBroadcast(laboratorioAttended, progress) {
    return {
        laboratorioAttended,
        broadcastStatus: progress?.status || null,
        dispatchStarted: Boolean(String(progress?.sendStartedAt || "").trim()),
        dispatchFinished: Boolean(String(progress?.sendFinishedAt || "").trim()),
        scheduledSendAt: progress?.scheduledSendAt || null,
    };
}
function labInProgressDisplayLabel(options) {
    const broadcast = String(options.broadcastStatus || "").trim();
    if (broadcast === "failed")
        return "Falha no envio";
    if (broadcast === "done" || options.dispatchFinished)
        return "Coletando relatório da Meta";
    if (broadcast === "running" || options.dispatchStarted)
        return "Enviando";
    const scheduled = String(options.scheduledSendAt || "").trim();
    if (scheduled && (broadcast === "queued" || !broadcast)) {
        const dueMs = Date.parse(scheduled);
        if (Number.isFinite(dueMs) && dueMs > Date.now())
            return "Agendado";
    }
    if (broadcast === "queued")
        return "Na fila";
    return "Meta analisando template";
}
const toCampaignIntakeDisplayStatus = (status, audience = "subscriber", options) => {
    if (status === "error_reported") {
        return audience === "operacional" ? "Erro reportado" : "Erro Reportado";
    }
    if (status === "completed")
        return "Finalizado";
    if (status === "cancelled")
        return "Cancelada";
    if (status === "in_progress") {
        if (options?.laboratorioAttended)
            return labInProgressDisplayLabel(options);
        return "Em andamento";
    }
    return audience === "operacional" ? "Aguardando configuração" : "Gerada";
};
exports.toCampaignIntakeDisplayStatus = toCampaignIntakeDisplayStatus;
const shouldCountCampaignIntakeCredits = (status) => {
    const normalized = (0, exports.normalizeCampaignIntakeStatus)(status);
    return normalized !== "error_reported" && normalized !== "cancelled";
};
exports.shouldCountCampaignIntakeCredits = shouldCountCampaignIntakeCredits;
