export const MANUAL_CAMPAIGN_REPORT_INCOMPLETE_MESSAGE =
  "Preencha todos os indicadores do relatório (enviados, entregues, lidos e falhados) antes de finalizar a campanha.";

export type ManualCampaignReportMetrics = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

const REQUIRED_FIELDS = ["sent", "delivered", "read", "failed"] as const;

export function parsePresentNonNegativeInt(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function parseManualCampaignReportMetrics(
  body: Record<string, unknown>,
): ManualCampaignReportMetrics | null {
  const sent = parsePresentNonNegativeInt(body.sent);
  const delivered = parsePresentNonNegativeInt(body.delivered);
  const read = parsePresentNonNegativeInt(body.read);
  const failed = parsePresentNonNegativeInt(body.failed);
  if ([sent, delivered, read, failed].some((value) => value == null)) {
    return null;
  }
  return {
    sent: sent as number,
    delivered: delivered as number,
    read: read as number,
    failed: failed as number,
  };
}

export function isManualCampaignReportIncomplete(
  metrics: ManualCampaignReportMetrics | null,
): boolean {
  if (!metrics) return true;
  return REQUIRED_FIELDS.every((field) => metrics[field] === 0);
}
