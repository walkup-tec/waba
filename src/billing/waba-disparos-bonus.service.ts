import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import {
  normalizeDispatchesApiKind,
  resolveIntakeApiKindFromIntake,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import { WabaDisparosBonusRepository } from "./waba-disparos-bonus.repository";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const resolveCampaignBonusShipments = (intake: {
  plannedSendCount?: number;
  performanceReport?: { totalLeads?: number; sent?: number } | null;
  status?: string;
}): number => {
  const status = String(intake.status ?? "").trim().toLowerCase();
  if (status !== "completed") return 0;
  const report = intake.performanceReport;
  if (!report) return 0;
  const totalLeads = Math.max(
    0,
    Math.round(Number(report.totalLeads ?? intake.plannedSendCount ?? 0)),
  );
  const sent = Math.max(0, Math.round(Number(report.sent ?? 0)));
  return Math.max(0, totalLeads - sent);
};

export class WabaDisparosBonusService {
  constructor(
    private readonly repository = new WabaDisparosBonusRepository(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
  ) {}

  syncPendingBonusFromCompletedCampaigns(email: string): void {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    for (const intake of this.intakeRepository.listByEmail(normalized)) {
      const bonusShipments = resolveCampaignBonusShipments(intake);
      if (bonusShipments > 0) {
        const apiKind = resolveIntakeApiKindFromIntake(intake);
        this.repository.grantFromCampaign(normalized, intake.id, bonusShipments, apiKind);
      }
    }
  }

  getPendingBonusShipments(email: string, apiKind?: WabaDispatchesApiKind): number {
    const normalized = normalizeEmail(email);
    if (!normalized) return 0;
    this.syncPendingBonusFromCompletedCampaigns(normalized);
    if (apiKind) return this.repository.getPendingShipments(normalized, apiKind);
    return this.repository.getPendingShipmentsTotal(normalized);
  }

  getEarliestGrantAt(email: string, apiKind: WabaDispatchesApiKind): string {
    const normalized = normalizeEmail(email);
    if (!normalized) return "";
    this.syncPendingBonusFromCompletedCampaigns(normalized);
    return this.repository.getEarliestGrantAt(normalized, apiKind);
  }

  grantCampaignBonus(
    email: string,
    campaignId: string,
    shipments: number,
    apiKind: WabaDispatchesApiKind,
  ): number {
    const normalized = normalizeEmail(email);
    const kind = normalizeDispatchesApiKind(apiKind) ?? "oficial";
    return this.repository.grantFromCampaign(normalized, campaignId, shipments, kind);
  }

  consumePendingBonus(email: string, apiKind: WabaDispatchesApiKind): number {
    const kind = normalizeDispatchesApiKind(apiKind) ?? "oficial";
    return this.repository.clearPendingShipments(normalizeEmail(email), kind);
  }

  listBonusGrantHistory(email: string, limit = 20) {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];
    this.syncPendingBonusFromCompletedCampaigns(normalized);
    return this.repository.listGrantHistory(normalized, limit);
  }
}
