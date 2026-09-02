import { WabaDisparosBonusService } from "../billing/waba-disparos-bonus.service";
import {
  buildLegacyBonusOnlyCreditFunding,
  normalizeCampaignCreditFunding,
} from "../billing/waba-campaign-credit-funding";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import { notifyCampaignCompletedEmail } from "../mail/waba-mail-delivery";
import { resolveIntakeApiKindFromIntake } from "./waba-dispatches-api-kind";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
  type WabaCampaignPerformanceReport,
} from "./waba-campaign-intake.repository";
import { normalizeCampaignIntakeStatus } from "./waba-campaign-intake-status";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export type FinalizeIntakeReportMetrics = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  clicks?: number;
};

export function finalizeIntakePerformanceReport(input: {
  campaignId: string;
  metrics: FinalizeIntakeReportMetrics;
  filledByEmail: string;
  source: "manual" | "meta_lab";
  intakeRepository?: WabaCampaignIntakeRepository;
  bonusService?: WabaDisparosBonusService;
  splitService?: WabaFinanceiroSplitService;
}): WabaCampaignIntake {
  const intakeRepository = input.intakeRepository || new WabaCampaignIntakeRepository();
  const bonusService = input.bonusService || new WabaDisparosBonusService();
  const splitService = input.splitService || new WabaFinanceiroSplitService();
  const intake = intakeRepository.getById(input.campaignId);
  if (!intake) throw new Error("Campanha não encontrada.");
  const status = normalizeCampaignIntakeStatus(intake.status);
  if (status === "completed" || status === "error_reported") {
    throw new Error("Esta campanha já foi finalizada.");
  }
  if (status === "cancelled") {
    throw new Error("Esta campanha foi cancelada e não pode receber relatório.");
  }
  if (status !== "in_progress") {
    throw new Error("Inicie a campanha antes de finalizar o relatório.");
  }

  const totalLeads = Math.max(0, Math.round(Number(intake.plannedSendCount || 0)));
  const now = new Date().toISOString();
  const performanceReport: WabaCampaignPerformanceReport = {
    totalLeads,
    sent: Math.max(0, Math.round(Number(input.metrics.sent || 0))),
    delivered: Math.max(0, Math.round(Number(input.metrics.delivered || 0))),
    read: Math.max(0, Math.round(Number(input.metrics.read || 0))),
    failed: Math.max(0, Math.round(Number(input.metrics.failed || 0))),
    ...(input.source === "meta_lab"
      ? { clicks: Math.max(0, Math.round(Number(input.metrics.clicks || 0))) }
      : {}),
    source: input.source,
    filledAt: now,
    filledByEmail: normalizeEmail(input.filledByEmail) || (input.source === "meta_lab" ? "meta-lab" : ""),
  };
  const bonusShipments = Math.max(0, totalLeads - performanceReport.sent);
  const creditFunding =
    normalizeCampaignCreditFunding(intake.creditFunding) ?? buildLegacyBonusOnlyCreditFunding(totalLeads);
  const updated = intakeRepository.updateById(input.campaignId, {
    performanceReport,
    status: "completed",
    creditFunding,
    updatedAt: now,
  });
  if (!updated) throw new Error("Não foi possível salvar o relatório.");

  if (bonusShipments > 0) {
    bonusService.grantCampaignBonus(
      intake.ownerEmail,
      input.campaignId,
      bonusShipments,
      resolveIntakeApiKindFromIntake(intake),
    );
  }
  notifyCampaignCompletedEmail({
    ownerEmail: intake.ownerEmail,
    campaignId: input.campaignId,
    campaignName: intake.campaignName,
  });
  const completedIntake = intakeRepository.getById(input.campaignId) ?? updated;
  void splitService.payoutSupplierForCompletedCampaign(completedIntake).then((settlement) => {
    if (settlement?.id) {
      intakeRepository.updateById(input.campaignId, {
        supplierPayoutSettlementId: settlement.id,
        updatedAt: new Date().toISOString(),
      });
    }
  });
  return completedIntake;
}
