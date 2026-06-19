"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCountCampaignIntakeCredits = exports.toCampaignIntakeDisplayStatus = exports.isCampaignIntakeFinalized = exports.normalizeCampaignIntakeStatus = void 0;
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
const toCampaignIntakeDisplayStatus = (status, audience = "subscriber") => {
    if (status === "in_progress")
        return "Em andamento";
    if (status === "error_reported") {
        return audience === "operacional" ? "Erro reportado" : "Erro Reportado";
    }
    if (status === "completed")
        return "Finalizado";
    if (status === "cancelled")
        return "Cancelada";
    return audience === "operacional" ? "Aguardando configuração" : "Gerada";
};
exports.toCampaignIntakeDisplayStatus = toCampaignIntakeDisplayStatus;
const shouldCountCampaignIntakeCredits = (status) => {
    const normalized = (0, exports.normalizeCampaignIntakeStatus)(status);
    return normalized !== "error_reported" && normalized !== "cancelled";
};
exports.shouldCountCampaignIntakeCredits = shouldCountCampaignIntakeCredits;
