import { normalizeCampaignIntakeStatus } from "../../disparos/waba-campaign-intake-status";

export function isLinkableLabCampaignStatus(status: string): boolean {
  return normalizeCampaignIntakeStatus(status) === "in_progress";
}

export function formatCloudLinkableCampaignLabel(input: {
  subscriberName?: string | null;
  ownerEmail?: string | null;
  campaignName?: string | null;
  plannedSendCount?: number;
}): string {
  const subscriber =
    String(input.subscriberName || "").trim() ||
    String(input.ownerEmail || "").trim() ||
    "Assinante";
  const campaign = String(input.campaignName || "").trim() || "Campanha";
  const envios = Math.max(0, Math.round(Number(input.plannedSendCount) || 0));
  return `${subscriber} - ${campaign} - ${envios}`;
}
