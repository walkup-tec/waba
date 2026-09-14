import { shouldAbortBroadcastOnHeaderMediaFailure } from "./meta-whatsapp-broadcast-void";
import { broadcastLeadIsPendingSend, type MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

export type CloudBroadcastHealthKey = "ok" | "header_media" | "missed_schedule" | "stalled" | "not_sending";

export type CloudBroadcastHealth = {
  ok: boolean;
  key: CloudBroadcastHealthKey;
  label: string;
};

const HEALTHY: CloudBroadcastHealth = { ok: true, key: "ok", label: "" };

/** Horário agendado passou e o loop ainda não começou. */
export const CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS = 90_000;
/** `updatedAt` parado com leads pendentes — o loop grava a cada envio. */
export const CLOUD_BROADCAST_STALL_MS = 150_000;
/** Campanha `running` sem nenhum processamento. */
export const CLOUD_BROADCAST_NOT_SENDING_MS = 180_000;

function parseIsoMs(value: string | null | undefined): number {
  const parsed = Date.parse(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function processedCount(row: Pick<MetaBroadcastCampaign, "sent" | "failed">): number {
  return Math.max(0, Math.round(Number(row.sent || 0))) + Math.max(0, Math.round(Number(row.failed || 0)));
}

export function evaluateCloudBroadcastHealth(
  row: Pick<
    MetaBroadcastCampaign,
    | "status"
    | "voidedAt"
    | "pausedAt"
    | "hiddenAt"
    | "sendStartedAt"
    | "scheduledSendAt"
    | "updatedAt"
    | "sent"
    | "failed"
    | "leads"
  > | null | undefined,
  nowMs = Date.now(),
): CloudBroadcastHealth {
  if (!row) return HEALTHY;
  if (String(row.voidedAt || "").trim() || String(row.pausedAt || "").trim() || String(row.hiddenAt || "").trim()) {
    return HEALTHY;
  }
  if (row.status === "done" || row.status === "failed") return HEALTHY;

  if (shouldAbortBroadcastOnHeaderMediaFailure(row)) {
    return {
      ok: false,
      key: "header_media",
      label: "Cabeçalho recusado — o lote não está entregando",
    };
  }

  const processed = processedCount(row);
  const scheduledMs = parseIsoMs(row.scheduledSendAt);
  if (row.status === "queued" && scheduledMs && scheduledMs + CLOUD_BROADCAST_MISSED_SCHEDULE_GRACE_MS < nowMs && processed === 0) {
    return {
      ok: false,
      key: "missed_schedule",
      label: "Horário passou e o disparo não começou",
    };
  }

  if (row.status !== "running") return HEALTHY;

  const updatedMs = parseIsoMs(row.updatedAt);
  const startedMs = parseIsoMs(row.sendStartedAt);
  const pending = (row.leads || []).some(broadcastLeadIsPendingSend);

  if (processed === 0) {
    const referenceMs = startedMs || updatedMs;
    if (referenceMs && nowMs - referenceMs > CLOUD_BROADCAST_NOT_SENDING_MS) {
      return {
        ok: false,
        key: "not_sending",
        label: "Campanha aberta, mas nenhuma mensagem saiu",
      };
    }
  }

  if (pending && updatedMs && nowMs - updatedMs > CLOUD_BROADCAST_STALL_MS) {
    return {
      ok: false,
      key: "stalled",
      label: "Disparo parado — não há envios recentes",
    };
  }

  return HEALTHY;
}
