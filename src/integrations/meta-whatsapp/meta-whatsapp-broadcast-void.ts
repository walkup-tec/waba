import type { MetaBroadcastCampaign, MetaBroadcastLead } from "./meta-whatsapp-broadcast.store";

/** Disparo Cloud da Jandira 2 que a Meta recusou (131053 / weblink 403). */
export const JANDIRA2_VOID_BROADCAST_ID = "26d33b09-8868-41dd-af78-afd59e7982f2";
export const JANDIRA2_RERUN_VOID_BROADCAST_ID = "c8e99348-4579-476c-b52d-af4f05d509df";
export const JANDIRA2_VOID_INTAKE_ID = "368d053b-d59b-4eed-a235-fe9e9f32c68c";

/** Opt in PTX / Paulo Teixeira: lote Cloud 1980 falhas sem fila (intake da tela pode ser outro UUID). */
export const OPT_IN_PTX_RESUME_INTAKE_ID = "c213963a-209a-465e-b3b6-85fef1328caf";
export const OPT_IN_PTX_RESUME_INTAKE_ID_LEGACY = "66c63991-9c2f-42a2-b024-7aeab1b71546";
export const OPT_IN_PTX_RESUME_BROADCAST_ID = "18c8340d-da12-47f1-8577-67f8a762aa32";

export function isOptInPtxResumeIntake(intakeCampaignId: string | null | undefined): boolean {
  const id = String(intakeCampaignId || "").trim();
  return id === OPT_IN_PTX_RESUME_INTAKE_ID || id === OPT_IN_PTX_RESUME_INTAKE_ID_LEGACY;
}

export function isOptInPtxResumeCampaign(row: {
  id?: string | null;
  intakeCampaignId?: string | null;
}): boolean {
  if (String(row.id || "").trim() === OPT_IN_PTX_RESUME_BROADCAST_ID) return true;
  return isOptInPtxResumeIntake(row.intakeCampaignId);
}

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

/** Cabeçalho recusado (131053): não continuar o lote — Graph aceita e ninguém recebe. */
export function shouldAbortBroadcastOnHeaderMediaFailure(
  row: Pick<MetaBroadcastCampaign, "leads"> | null | undefined,
): boolean {
  const leads = Array.isArray(row?.leads) ? row!.leads : [];
  if (!leads.some((lead) => String(lead.errorCode || "") === "131053")) return false;
  if (leads.some(leadCountsAsDelivered)) return false;
  return true;
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
  if (isOptInPtxResumeCampaign(row)) return false;
  if (String(row.id || "") === JANDIRA2_VOID_BROADCAST_ID) return true;
  if (String(row.id || "") === JANDIRA2_RERUN_VOID_BROADCAST_ID) return true;
  if (shouldAbortBroadcastOnHeaderMediaFailure(row)) return true;
  if (String(row.intakeCampaignId || "") === JANDIRA2_VOID_INTAKE_ID && isBroadcastAbandonedForRetry(row)) {
    return true;
  }
  return false;
}

export function isCloudBroadcastInactiveForRetry(row: MetaBroadcastCampaign | null | undefined): boolean {
  if (!row) return true;
  return (
    isBroadcastVoided(row) ||
    isBroadcastAbandonedForRetry(row) ||
    shouldAbortBroadcastOnHeaderMediaFailure(row)
  );
}
