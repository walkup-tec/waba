import type { CloudBroadcastProgressHint } from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import type { WabaCampaignIntakeStatus } from "./waba-campaign-intake.repository";

export type CampaignIntakeDisplayOptions = {
  laboratorioAttended?: boolean;
  broadcastStatus?: string | null;
  dispatchStarted?: boolean;
  dispatchFinished?: boolean;
  scheduledSendAt?: string | null;
};

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

export function campaignIntakeDisplayOptionsFromBroadcast(
  laboratorioAttended: boolean,
  progress?: CloudBroadcastProgressHint | null,
): CampaignIntakeDisplayOptions {
  return {
    laboratorioAttended,
    broadcastStatus: progress?.status || null,
    dispatchStarted: Boolean(String(progress?.sendStartedAt || "").trim()),
    dispatchFinished: Boolean(String(progress?.sendFinishedAt || "").trim()),
    scheduledSendAt: progress?.scheduledSendAt || null,
  };
}

function labInProgressDisplayLabel(options: CampaignIntakeDisplayOptions): string {
  const broadcast = String(options.broadcastStatus || "").trim();
  if (broadcast === "failed") return "Falha no envio";
  if (broadcast === "done" || options.dispatchFinished) return "Coletando relatório da Meta";
  if (broadcast === "running" || options.dispatchStarted) return "Enviando";
  const scheduled = String(options.scheduledSendAt || "").trim();
  if (scheduled && (broadcast === "queued" || !broadcast)) {
    const dueMs = Date.parse(scheduled);
    if (Number.isFinite(dueMs) && dueMs > Date.now()) return "Agendado";
  }
  if (broadcast === "queued") return "Na fila";
  return "Meta analisando template";
}

export const toCampaignIntakeDisplayStatus = (
  status: WabaCampaignIntakeStatus,
  audience: "operacional" | "subscriber" = "subscriber",
  options?: CampaignIntakeDisplayOptions,
): string => {
  if (status === "error_reported") {
    return audience === "operacional" ? "Erro reportado" : "Erro Reportado";
  }
  if (status === "completed") return "Finalizado";
  if (status === "cancelled") return "Cancelada";
  if (status === "in_progress") {
    if (options?.laboratorioAttended) return labInProgressDisplayLabel(options);
    return "Em andamento";
  }
  return audience === "operacional" ? "Aguardando configuração" : "Gerada";
};

export const shouldCountCampaignIntakeCredits = (status: string): boolean => {
  const normalized = normalizeCampaignIntakeStatus(status);
  return normalized !== "error_reported" && normalized !== "cancelled";
};

/** Envios realizados da campanha (relatório). Sem relatório, usa o planejado. Erro/cancelada = 0. */
export const resolveCampaignRealizedShipments = (intake: {
  status?: string;
  plannedSendCount?: number;
  performanceReport?: { sent?: number } | null;
}): number => {
  if (!shouldCountCampaignIntakeCredits(String(intake.status ?? ""))) return 0;
  const status = normalizeCampaignIntakeStatus(String(intake.status ?? ""));
  const sent = Math.round(Number(intake.performanceReport?.sent ?? Number.NaN));
  if (status === "completed" && Number.isFinite(sent) && sent >= 0) {
    return Math.max(0, sent);
  }
  return Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
};
