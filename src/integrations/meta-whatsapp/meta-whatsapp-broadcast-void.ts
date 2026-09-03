import type { MetaBroadcastCampaign, MetaBroadcastLead } from "./meta-whatsapp-broadcast.store";

/** Disparo Cloud da Jandira 2 que a Meta recusou (131053 / weblink 403). */
export const JANDIRA2_VOID_BROADCAST_ID = "26d33b09-8868-41dd-af78-afd59e7982f2";
export const JANDIRA2_VOID_INTAKE_ID = "368d053b-d59b-4eed-a235-fe9e9f32c68c";

function leadCountsAsDelivered(lead: MetaBroadcastLead): boolean {
  const meta = String(lead.metaStatus || "");
  return meta === "delivered" || meta === "read";
}

function leadCountsAsFailed(lead: MetaBroadcastLead): boolean {
  return lead.status === "failed" || String(lead.metaStatus || "") === "failed";
}

export function isBroadcastVoided(
  row: Pick<MetaBroadcastCampaign, "voidedAt"> | null | undefined,
): boolean {
  return Boolean(String(row?.voidedAt || "").trim());
}

/** Envio já terminou, ninguém recebeu e todos os leads falharam no webhook. */
export function isBroadcastAbandonedForRetry(
  row: Pick<MetaBroadcastCampaign, "status" | "leads"> | null | undefined,
): boolean {
  if (!row) return false;
  if (row.status === "queued" || row.status === "running") return false;
  const leads = Array.isArray(row.leads) ? row.leads : [];
  if (!leads.length) return false;
  if (leads.some(leadCountsAsDelivered)) return false;
  return leads.every((lead) => leadCountsAsFailed(lead) || lead.status === "skipped");
}

export function shouldVoidCloudBroadcast(row: MetaBroadcastCampaign): boolean {
  if (isBroadcastVoided(row)) return false;
  if (String(row.id || "") === JANDIRA2_VOID_BROADCAST_ID) return true;
  if (String(row.intakeCampaignId || "") === JANDIRA2_VOID_INTAKE_ID && isBroadcastAbandonedForRetry(row)) {
    return true;
  }
  return false;
}

export function isCloudBroadcastInactiveForRetry(row: MetaBroadcastCampaign | null | undefined): boolean {
  if (!row) return true;
  return isBroadcastVoided(row) || isBroadcastAbandonedForRetry(row);
}
