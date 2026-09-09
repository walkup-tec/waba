"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaDisparosBonusService = void 0;
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("../disparos/waba-campaign-intake-status");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_disparos_bonus_repository_1 = require("./waba-disparos-bonus.repository");
const normalizeEmail = (value) => value.trim().toLowerCase();
const resolveCampaignBonusShipments = (intake) => {
    const status = String(intake.status ?? "").trim().toLowerCase();
    if (status !== "completed")
        return 0;
    const report = intake.performanceReport;
    if (!report)
        return 0;
    const totalLeads = Math.max(0, Math.round(Number(report.totalLeads ?? intake.plannedSendCount ?? 0)));
    const sent = Math.max(0, Math.round(Number(report.sent ?? 0)));
    return Math.max(0, totalLeads - sent);
};
const firstValidIso = (...candidates) => {
    for (const candidate of candidates) {
        const value = String(candidate ?? "").trim();
        if (!value)
            continue;
        const ms = Date.parse(value);
        if (Number.isFinite(ms))
            return new Date(ms).toISOString();
    }
    return new Date().toISOString();
};
/** Data da campanha, não a hora em que o JSON de bônus foi gravado. */
const resolveCampaignBonusGrantedAt = (intake) => firstValidIso(intake.createdAt, intake.startedAt, intake.performanceReport?.filledAt, intake.updatedAt);
class WabaDisparosBonusService {
    constructor(repository = new waba_disparos_bonus_repository_1.WabaDisparosBonusRepository(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository()) {
        this.repository = repository;
        this.intakeRepository = intakeRepository;
    }
    syncPendingBonusFromCompletedCampaigns(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return;
        for (const intake of this.intakeRepository.listByEmail(normalized)) {
            const grantedAt = resolveCampaignBonusGrantedAt(intake);
            const bonusShipments = resolveCampaignBonusShipments(intake);
            if (bonusShipments > 0) {
                const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
                this.repository.grantFromCampaign(normalized, intake.id, bonusShipments, apiKind, grantedAt);
            }
            else {
                this.repository.alignGrantGrantedAt(normalized, intake.id, grantedAt);
            }
        }
    }
    getPendingBonusShipments(email, apiKind) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return 0;
        this.syncPendingBonusFromCompletedCampaigns(normalized);
        if (apiKind)
            return this.repository.getPendingShipments(normalized, apiKind);
        return this.repository.getPendingShipmentsTotal(normalized);
    }
    getEarliestGrantAt(email, apiKind) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return "";
        this.syncPendingBonusFromCompletedCampaigns(normalized);
        return this.repository.getEarliestGrantAt(normalized, apiKind);
    }
    grantCampaignBonus(email, campaignId, shipments, apiKind, grantedAt) {
        const normalized = normalizeEmail(email);
        const kind = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(apiKind) ?? "oficial";
        return this.repository.grantFromCampaign(normalized, campaignId, shipments, kind, grantedAt);
    }
    listGrantsForApi(email, apiKind) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return [];
        this.syncPendingBonusFromCompletedCampaigns(normalized);
        return this.repository.listGrants(normalized, apiKind);
    }
    consumePendingBonus(email, apiKind) {
        const kind = (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(apiKind) ?? "oficial";
        return this.repository.clearPendingShipments(normalizeEmail(email), kind);
    }
    listBonusGrantHistory(email, limit = 20) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return [];
        this.syncPendingBonusFromCompletedCampaigns(normalized);
        const intakesById = new Map(this.intakeRepository.listByEmail(normalized).map((intake) => [intake.id, intake]));
        return this.repository
            .listGrantHistory(normalized, limit)
            .filter((item) => {
            const intake = intakesById.get(item.campaignId);
            if (!intake)
                return item.shipments > 0;
            if (!(0, waba_campaign_intake_status_1.shouldCountCampaignIntakeCredits)(intake.status))
                return false;
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
exports.WabaDisparosBonusService = WabaDisparosBonusService;
