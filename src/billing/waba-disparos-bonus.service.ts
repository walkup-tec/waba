import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import { shouldCountCampaignIntakeCredits } from "../disparos/waba-campaign-intake-status";
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

const firstValidIso = (...candidates: Array<string | undefined>): string => {
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
};

/** Data da campanha, não a hora em que o JSON de bônus foi gravado. */
const resolveCampaignBonusGrantedAt = (intake: {
  createdAt?: string;
  startedAt?: string;
  updatedAt?: string;
  performanceReport?: { filledAt?: string } | null;
}): string =>
  firstValidIso(
    intake.createdAt,
    intake.startedAt,
    intake.performanceReport?.filledAt,
    intake.updatedAt,
  );

export class WabaDisparosBonusService {
  constructor(
    private readonly repository = new WabaDisparosBonusRepository(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
  ) {}

  syncPendingBonusFromCompletedCampaigns(email: string): void {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    for (const intake of this.intakeRepository.listByEmail(normalized)) {
      const grantedAt = resolveCampaignBonusGrantedAt(intake);
      const bonusShipments = resolveCampaignBonusShipments(intake);
      if (bonusShipments > 0) {
        const apiKind = resolveIntakeApiKindFromIntake(intake);
        this.repository.grantFromCampaign(
          normalized,
          intake.id,
          bonusShipments,
          apiKind,
          grantedAt,
        );
      } else {
        this.repository.alignGrantGrantedAt(normalized, intake.id, grantedAt);
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
    grantedAt?: string,
  ): number {
    const normalized = normalizeEmail(email);
    const kind = normalizeDispatchesApiKind(apiKind) ?? "oficial";
    return this.repository.grantFromCampaign(normalized, campaignId, shipments, kind, grantedAt);
  }

  listGrantsForApi(email: string, apiKind: WabaDispatchesApiKind) {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];
    this.syncPendingBonusFromCompletedCampaigns(normalized);
    return this.repository.listGrants(normalized, apiKind);
  }

  consumePendingBonus(email: string, apiKind: WabaDispatchesApiKind): number {
    const kind = normalizeDispatchesApiKind(apiKind) ?? "oficial";
    return this.repository.clearPendingShipments(normalizeEmail(email), kind);
  }

  listBonusGrantHistory(email: string, limit = 20) {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];
    this.syncPendingBonusFromCompletedCampaigns(normalized);
    const intakesById = new Map(
      this.intakeRepository.listByEmail(normalized).map((intake) => [intake.id, intake]),
    );
    return this.repository
      .listGrantHistory(normalized, limit)
      .filter((item) => {
        const intake = intakesById.get(item.campaignId);
        if (!intake) return item.shipments > 0;
        if (!shouldCountCampaignIntakeCredits(intake.status)) return false;
        return resolveCampaignBonusShipments(intake) > 0 || item.shipments > 0;
      })
      .map((item) => {
        const intake = intakesById.get(item.campaignId);
        const campaignName = String(intake?.campaignName ?? "").trim();
        return {
          ...item,
          campaignName: campaignName || item.campaignId,
        };
      });
  }
}
