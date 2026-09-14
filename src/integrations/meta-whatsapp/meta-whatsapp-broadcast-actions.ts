import type { MetaBroadcastCampaign } from "./meta-whatsapp-broadcast.store";

export type CloudBroadcastActionDecision = { ok: true } | { ok: false; error: string; code: string };

function processedCount(row: Pick<MetaBroadcastCampaign, "sent" | "failed">): number {
  return Math.max(0, Math.round(Number(row.sent || 0))) + Math.max(0, Math.round(Number(row.failed || 0)));
}

export function cloudBroadcastHasStarted(
  row: Pick<MetaBroadcastCampaign, "status" | "sendStartedAt" | "sent" | "failed">,
): boolean {
  if (String(row.sendStartedAt || "").trim()) return true;
  if (processedCount(row) > 0) return true;
  return row.status === "running" || row.status === "done";
}

export function cloudBroadcastActionFlags(
  row: Pick<
    MetaBroadcastCampaign,
    "status" | "sendStartedAt" | "sent" | "failed" | "voidedAt" | "pausedAt" | "hiddenAt"
  >,
): {
  canCancel: boolean;
  canPause: boolean;
  canDelete: boolean;
  showPause: boolean;
} {
  const hidden = Boolean(String(row.hiddenAt || "").trim());
  const voided = Boolean(String(row.voidedAt || "").trim());
  const paused = Boolean(String(row.pausedAt || "").trim());
  const started = cloudBroadcastHasStarted(row);
  const sending = row.status === "queued" || row.status === "running";
  return {
    canCancel: !hidden && !voided && !paused && !started && row.status === "queued",
    canPause: !hidden && !voided && !paused && started && sending,
    canDelete: !hidden,
    showPause: !hidden && started,
  };
}

export function decideCancelBroadcast(row: MetaBroadcastCampaign): CloudBroadcastActionDecision {
  if (String(row.hiddenAt || "").trim()) {
    return { ok: false, code: "already_hidden", error: "Esta campanha já foi excluída da lista." };
  }
  if (String(row.voidedAt || "").trim()) {
    return { ok: false, code: "already_cancelled", error: "Esta campanha já foi cancelada." };
  }
  if (String(row.pausedAt || "").trim()) {
    return { ok: false, code: "already_paused", error: "Campanha pausada. Use Excluir para tirá-la da lista." };
  }
  if (cloudBroadcastHasStarted(row)) {
    return { ok: false, code: "already_started", error: "O disparo já começou. Use Pausar para interromper." };
  }
  if (row.status !== "queued") {
    return { ok: false, code: "not_cancellable", error: "Só é possível cancelar uma campanha que ainda não iniciou." };
  }
  return { ok: true };
}

export function decidePauseBroadcast(row: MetaBroadcastCampaign): CloudBroadcastActionDecision {
  if (String(row.hiddenAt || "").trim()) {
    return { ok: false, code: "already_hidden", error: "Esta campanha já foi excluída da lista." };
  }
  if (String(row.voidedAt || "").trim()) {
    return { ok: false, code: "already_cancelled", error: "Esta campanha já foi cancelada." };
  }
  if (String(row.pausedAt || "").trim()) {
    return { ok: false, code: "already_paused", error: "Esta campanha já está pausada." };
  }
  if (!cloudBroadcastHasStarted(row)) {
    return { ok: false, code: "not_started", error: "O disparo ainda não começou. Use Cancelar." };
  }
  if (row.status !== "queued" && row.status !== "running") {
    return { ok: false, code: "not_running", error: "Esta campanha já não está disparando." };
  }
  return { ok: true };
}

export function decideHideBroadcast(row: MetaBroadcastCampaign): CloudBroadcastActionDecision {
  if (String(row.hiddenAt || "").trim()) {
    return { ok: false, code: "already_hidden", error: "Esta campanha já foi excluída da lista." };
  }
  return { ok: true };
}
