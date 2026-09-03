import {
  broadcastLeadIsPendingSend,
  type MetaBroadcastCampaign,
} from "./meta-whatsapp-broadcast.store";

/** Intervalo do guardião em processo (retoma loop morto sem Redeploy). */
export const CLOUD_BROADCAST_RESUME_WATCHDOG_MS = 20_000;

export type CloudBroadcastProtectItem = {
  id: string;
  tenantId: string;
  templateName: string;
  intakeCampaignId?: string;
  status: string;
  sent: number;
  failed: number;
  total: number;
  pending: number;
  loopAlive: boolean;
};

export type CloudBroadcastProtectSnapshot = {
  /** Há Disparo Cloud ativo (running/queued, não void). */
  active: boolean;
  count: number;
  pendingLeads: number;
  /** true = NÃO Redeployar o disparador agora. */
  blockRedeploy: boolean;
  resumeWatchdogMs: number;
  policy: "resume_on_boot_and_watchdog";
  items: CloudBroadcastProtectItem[];
};

function pendingCount(row: MetaBroadcastCampaign): number {
  return (row.leads || []).filter(broadcastLeadIsPendingSend).length;
}

/**
 * Snapshot seguro para /health — sem tokens, telefones ou conteúdo de leads.
 * Operacional e agentes usam `blockRedeploy` antes de Redeploy EasyPanel.
 */
export function buildCloudBroadcastProtectSnapshot(input: {
  campaigns: MetaBroadcastCampaign[];
  isLoopAlive: (campaignId: string) => boolean;
  watchdogMs?: number;
}): CloudBroadcastProtectSnapshot {
  const items: CloudBroadcastProtectItem[] = input.campaigns
    .filter((row) => {
      if (String(row.voidedAt || "").trim()) return false;
      return row.status === "running" || row.status === "queued";
    })
    .map((row) => {
      const pending = pendingCount(row);
      return {
        id: row.id,
        tenantId: row.tenantId,
        templateName: String(row.templateName || "").slice(0, 80),
        ...(row.intakeCampaignId ? { intakeCampaignId: row.intakeCampaignId } : {}),
        status: row.status,
        sent: Math.max(0, Number(row.sent) || 0),
        failed: Math.max(0, Number(row.failed) || 0),
        total: Math.max(0, Number(row.total) || 0),
        pending,
        loopAlive: input.isLoopAlive(row.id),
      };
    })
    .sort((a, b) => b.pending - a.pending || a.id.localeCompare(b.id));

  const pendingLeads = items.reduce((sum, item) => sum + item.pending, 0);
  return {
    active: items.length > 0,
    count: items.length,
    pendingLeads,
    blockRedeploy: items.some((item) => item.pending > 0 || item.status === "running"),
    resumeWatchdogMs: Math.max(5_000, Number(input.watchdogMs) || CLOUD_BROADCAST_RESUME_WATCHDOG_MS),
    policy: "resume_on_boot_and_watchdog",
    items,
  };
}
