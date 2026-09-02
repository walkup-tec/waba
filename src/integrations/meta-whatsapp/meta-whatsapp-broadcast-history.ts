import { normalizeCampaignIntakeStatus } from "../../disparos/waba-campaign-intake-status";
import { publicBroadcastCampaign, type MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

export function cloudBroadcastProgress(input: {
  sent?: number;
  failed?: number;
  total?: number;
  plannedSendCount?: number;
  status?: string;
}): { processed: number; requested: number; percent: number } {
  const requested = Math.max(0, Math.round(Number(input.plannedSendCount || input.total || 0)));
  const processed = Math.max(0, Math.round(Number(input.sent || 0) + Number(input.failed || 0)));
  if (!requested) return { processed, requested: 0, percent: 0 };
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

export function cloudBroadcastDisplayStatus(input: {
  broadcastStatus?: string | null;
  intakeStatus?: string | null;
}): { key: string; label: string } {
  const intake = input.intakeStatus ? normalizeCampaignIntakeStatus(input.intakeStatus) : "";
  if (intake === "completed") return { key: "completed", label: "Finalizado" };
  if (intake === "error_reported") return { key: "error", label: "Erro reportado" };
  if (intake === "cancelled") return { key: "cancelled", label: "Cancelada" };
  const broadcast = String(input.broadcastStatus || "");
  if (broadcast === "queued") return { key: "queued", label: "Na fila" };
  if (broadcast === "running") return { key: "running", label: "Enviando" };
  if (broadcast === "failed") return { key: "failed", label: "Falha no envio" };
  if (broadcast === "done" && intake === "in_progress") {
    return { key: "collecting", label: "Coletando relatório da Meta" };
  }
  if (broadcast === "done") return { key: "done", label: "Envio concluído" };
  if (intake === "in_progress") return { key: "in_progress", label: "Em andamento" };
  return { key: "unknown", label: "Em andamento" };
}

export function toCloudBroadcastHistoryItem(input: {
  campaign: MetaBroadcastCampaign;
  campaignName?: string | null;
  clientName?: string | null;
  plannedSendCount?: number;
  intakeStatus?: string | null;
}) {
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
  });
  return {
    ...publicBroadcastCampaign(input.campaign),
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
