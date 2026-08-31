import type { WabaCampaignIntakeStatus } from "./waba-campaign-intake.repository";

export const normalizeCampaignIntakeStatus = (status: string): WabaCampaignIntakeStatus => {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "pending_review" || raw === "generated") return "generated";
  if (raw === "in_progress") return "in_progress";
  if (raw === "error_reported") return "error_reported";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  return "generated";
};

export const isCampaignIntakeFinalized = (status: string): boolean => {
  const normalized = normalizeCampaignIntakeStatus(status);
  return normalized === "completed" || normalized === "error_reported";
};

export const toCampaignIntakeDisplayStatus = (
  status: WabaCampaignIntakeStatus,
  audience: "operacional" | "subscriber" = "subscriber",
): string => {
  if (status === "in_progress") return "Em andamento";
  if (status === "error_reported") {
    return audience === "operacional" ? "Erro reportado" : "Erro Reportado";
  }
  if (status === "completed") return "Finalizado";
  if (status === "cancelled") return "Cancelada";
  return audience === "operacional" ? "Aguardando configuração" : "Gerada";
};

export const shouldCountCampaignIntakeCredits = (status: string): boolean => {
  const normalized = normalizeCampaignIntakeStatus(status);
  return normalized !== "error_reported" && normalized !== "cancelled";
};
