import { WabaCampaignIntakeRepository } from "../../disparos/waba-campaign-intake.repository";
import { normalizeCampaignIntakeStatus } from "../../disparos/waba-campaign-intake-status";
import {
  listAllBroadcastCampaigns,
  type MetaBroadcastCampaign,
} from "./meta-whatsapp-broadcast.store";
import { isCloudBroadcastInactiveForRetry } from "./meta-whatsapp-broadcast-void";
import { campaignPhoneNumberIds } from "./meta-whatsapp-broadcast-split";
import type { MetaPortfolioNumberPublic } from "./meta-whatsapp-portfolio.types";

export function isCloudPhoneBusyForCampaign(input: {
  broadcastStatus: MetaBroadcastCampaign["status"];
  intakeStatus?: string | null;
  inactive?: boolean;
}): boolean {
  if (input.inactive) {
    return input.broadcastStatus === "queued" || input.broadcastStatus === "running";
  }
  if (input.intakeStatus) {
    const intake = normalizeCampaignIntakeStatus(input.intakeStatus);
    if (intake === "completed" || intake === "error_reported" || intake === "cancelled") {
      return false;
    }
    if (intake === "generated" || intake === "in_progress") {
      return true;
    }
  }
  return input.broadcastStatus === "queued" || input.broadcastStatus === "running";
}

export function collectBusyCloudPhoneNumberIds(
  campaigns: ReadonlyArray<{
    phoneNumberId?: string;
    phoneNumberIds?: string[];
    status: MetaBroadcastCampaign["status"];
    intakeCampaignId?: string;
    voidedAt?: string;
    leads?: MetaBroadcastCampaign["leads"];
  }>,
  intakeStatusById: ReadonlyMap<string, string>,
): Set<string> {
  const busy = new Set<string>();
  for (const row of campaigns) {
    const intakeId = String(row.intakeCampaignId || "").trim();
    const intakeStatus = intakeId ? intakeStatusById.get(intakeId) : undefined;
    if (
      !isCloudPhoneBusyForCampaign({
        broadcastStatus: row.status,
        intakeStatus,
        inactive: isCloudBroadcastInactiveForRetry(row as MetaBroadcastCampaign),
      })
    ) {
      continue;
    }
    for (const phoneId of campaignPhoneNumberIds(row)) {
      busy.add(phoneId);
    }
  }
  return busy;
}

export function listBusyCloudPhoneNumberIds(tenantId: string): Set<string> {
  const campaigns = listAllBroadcastCampaigns(tenantId);
  const intakeIds = [
    ...new Set(campaigns.map((row) => String(row.intakeCampaignId || "").trim()).filter(Boolean)),
  ];
  const intakeStatusById = new Map<string, string>();
  if (intakeIds.length) {
    const intakes = new WabaCampaignIntakeRepository();
    for (const id of intakeIds) {
      const intake = intakes.getById(id);
      if (intake) intakeStatusById.set(id, intake.status);
    }
  }
  return collectBusyCloudPhoneNumberIds(campaigns, intakeStatusById);
}

export function applyCloudPhoneOccupancy(
  tenantId: string,
  numbers: MetaPortfolioNumberPublic[],
  busyPhoneIds?: ReadonlySet<string>,
): MetaPortfolioNumberPublic[] {
  const busy = busyPhoneIds || listBusyCloudPhoneNumberIds(tenantId);
  return numbers.map((row) => ({
    ...row,
    dispatchStatus: busy.has(String(row.phoneNumberId || "").trim()) ? "em_disparo" : "livre",
  }));
}
