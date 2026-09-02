"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeIntakePerformanceReport = finalizeIntakePerformanceReport;
const waba_disparos_bonus_service_1 = require("../billing/waba-disparos-bonus.service");
const waba_campaign_credit_funding_1 = require("../billing/waba-campaign-credit-funding");
const waba_financeiro_split_service_1 = require("../billing/waba-financeiro-split.service");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const waba_dispatches_api_kind_1 = require("./waba-dispatches-api-kind");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_intake_status_1 = require("./waba-campaign-intake-status");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
function finalizeIntakePerformanceReport(input) {
    const intakeRepository = input.intakeRepository || new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const bonusService = input.bonusService || new waba_disparos_bonus_service_1.WabaDisparosBonusService();
    const splitService = input.splitService || new waba_financeiro_split_service_1.WabaFinanceiroSplitService();
    const intake = intakeRepository.getById(input.campaignId);
    if (!intake)
        throw new Error("Campanha não encontrada.");
    const status = (0, waba_campaign_intake_status_1.normalizeCampaignIntakeStatus)(intake.status);
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
    const performanceReport = {
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
    const creditFunding = (0, waba_campaign_credit_funding_1.normalizeCampaignCreditFunding)(intake.creditFunding) ?? (0, waba_campaign_credit_funding_1.buildLegacyBonusOnlyCreditFunding)(totalLeads);
    const updated = intakeRepository.updateById(input.campaignId, {
        performanceReport,
        status: "completed",
        creditFunding,
        updatedAt: now,
    });
    if (!updated)
        throw new Error("Não foi possível salvar o relatório.");
    if (bonusShipments > 0) {
        bonusService.grantCampaignBonus(intake.ownerEmail, input.campaignId, bonusShipments, (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake));
    }
    (0, waba_mail_delivery_1.notifyCampaignCompletedEmail)({
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
