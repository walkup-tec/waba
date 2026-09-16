import { WABA_ENV } from "../load-env";
import {
  findBroadcastByIntakeCampaignId,
  saveBroadcastCampaign,
} from "../integrations/meta-whatsapp/meta-whatsapp-broadcast.store";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { normalizeCampaignIntakeStatus } from "./waba-campaign-intake-status";
import { finalizeIntakePerformanceReport } from "./waba-campaign-report-finalize.service";
import { resolveCampaignReportOverride } from "./waba-campaign-report-read-overrides";

export type ForcedCampaignReportCompleteResult = {
  applied: number;
  skipped: number;
  campaignIds: string[];
  message: string;
};

export type ForcedCampaignReportCompleteDeps = {
  forceLocal?: boolean;
  intakeRepository?: WabaCampaignIntakeRepository;
  finalize?: typeof finalizeIntakePerformanceReport;
  now?: () => string;
};

const existingClicks = (intake: WabaCampaignIntake): number | undefined => {
  const stored = Math.round(Number(intake.performanceReport?.clicks));
  if (Number.isFinite(stored) && stored >= 0) return stored;
  const broadcast = findBroadcastByIntakeCampaignId(intake.id);
  const live = Math.round(Number(broadcast?.clicks));
  if (Number.isFinite(live) && live >= 0) return live;
  return undefined;
};

export function runForcedCampaignReportCompleteOneshot(
  deps: ForcedCampaignReportCompleteDeps = {},
): ForcedCampaignReportCompleteResult {
  const env = String(WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
  if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return {
      applied: 0,
      skipped: 0,
      campaignIds: [],
      message: "oneshot ignorado em ambiente local",
    };
  }

  const intakeRepository = deps.intakeRepository || new WabaCampaignIntakeRepository();
  const finalize = deps.finalize || finalizeIntakePerformanceReport;
  const now = deps.now || (() => new Date().toISOString());
  const campaignIds: string[] = [];
  let skipped = 0;

  for (const intake of intakeRepository.listAll()) {
    const rule = resolveCampaignReportOverride(
      intake.campaignName,
      intake.createdAt,
      intake.performanceReport,
      intake.id,
    );
    if (!rule?.forceCompleted) continue;
    const status = normalizeCampaignIntakeStatus(intake.status);
    if (status === "completed" || status === "error_reported" || status === "cancelled") {
      skipped += 1;
      continue;
    }
    if (status !== "in_progress") {
      skipped += 1;
      continue;
    }
    try {
      finalize({
        campaignId: intake.id,
        metrics: {
          sent: rule.sent ?? 0,
          delivered: rule.delivered ?? 0,
          read: rule.read ?? 0,
          failed: rule.failed ?? 0,
          clicks: rule.clicks ?? existingClicks(intake),
        },
        filledByEmail: "meta-lab",
        source: "meta_lab",
        intakeRepository,
      });
      const broadcast = findBroadcastByIntakeCampaignId(intake.id);
      if (broadcast && !broadcast.reportFinalizedAt) {
        broadcast.reportFinalizedAt = now();
        saveBroadcastCampaign(broadcast);
      }
      campaignIds.push(intake.id);
    } catch (error) {
      skipped += 1;
      console.error(
        `[campanhas] falha ao finalizar relatório pontual ${intake.campaignName}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    applied: campaignIds.length,
    skipped,
    campaignIds,
    message: campaignIds.length
      ? `Relatório pontual finalizado (${campaignIds.join(", ")})`
      : skipped
        ? "Relatório pontual já estava finalizado ou fora de andamento"
        : "Nenhuma campanha pontual para finalizar",
  };
}
