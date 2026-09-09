"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDisparosCreditsByApi = exports.emptyDisparosApiCreditsBucket = exports.WabaDisparosCreditsService = void 0;
const waba_master_disparos_policy_service_1 = require("../users/waba-master-disparos-policy.service");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_api_credits_1 = require("./waba-disparos-api-credits");
Object.defineProperty(exports, "emptyDisparosApiCreditsBucket", { enumerable: true, get: function () { return waba_disparos_api_credits_1.emptyDisparosApiCreditsBucket; } });
Object.defineProperty(exports, "emptyDisparosCreditsByApi", { enumerable: true, get: function () { return waba_disparos_api_credits_1.emptyDisparosCreditsByApi; } });
const waba_disparos_bonus_settlement_service_1 = require("./waba-disparos-bonus-settlement.service");
const waba_disparos_bonus_service_1 = require("./waba-disparos-bonus.service");
const waba_cleison_oficial_balance_repair_1 = require("./waba-cleison-oficial-balance-repair");
const waba_disparos_credit_usage_repository_1 = require("./waba-disparos-credit-usage.repository");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_campaign_intake_status_1 = require("../disparos/waba-campaign-intake-status");
const waba_disparos_real_purchases_1 = require("./waba-disparos-real-purchases");
const normalizeEmail = (value) => value.trim().toLowerCase();
const UNLIMITED_CREDITS_REMAINING = 9999999;
class WabaDisparosCreditsService {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), usageRepository = new waba_disparos_credit_usage_repository_1.WabaDisparosCreditUsageRepository(), bonusService = new waba_disparos_bonus_service_1.WabaDisparosBonusService(), bonusSettlementService = new waba_disparos_bonus_settlement_service_1.WabaDisparosBonusSettlementService(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), masterPolicyService = new waba_master_disparos_policy_service_1.WabaMasterDisparosPolicyService(), cleisonBalanceRepair = new waba_cleison_oficial_balance_repair_1.WabaCleisonOficialBalanceRepair()) {
        this.orderRepository = orderRepository;
        this.usageRepository = usageRepository;
        this.bonusService = bonusService;
        this.bonusSettlementService = bonusSettlementService;
        this.intakeRepository = intakeRepository;
        this.masterPolicyService = masterPolicyService;
        this.cleisonBalanceRepair = cleisonBalanceRepair;
    }
    listPaidOrdersForEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return [];
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos" &&
            order.status === "paid" &&
            normalizeEmail(order.ownerEmail) === normalized &&
            String(order.paidAt ?? "").trim().length > 0)
            .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
    }
    prepareCreditsLedger(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return "";
        this.ensureUsageMigrated(normalized);
        this.cleisonBalanceRepair.applyIfNeeded(normalized);
        this.bonusSettlementService.settleAllUnsettledPaidOrdersForEmail(normalized);
        return normalized;
    }
    listRealPurchasesForEmail(email) {
        return (0, waba_disparos_real_purchases_1.listRealPaidPurchases)(this.orderRepository.list(), email);
    }
    sumRealizedFromCampaigns(email, apiKind) {
        let total = 0;
        for (const intake of this.intakeRepository.listByEmail(email)) {
            if ((0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake) !== apiKind)
                continue;
            total += (0, waba_campaign_intake_status_1.resolveCampaignRealizedShipments)(intake);
        }
        return total;
    }
    rebuildConsumedByApiFromIntakes(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return;
        const consumedByApi = {
            oficial: 0,
            alternativa: 0,
        };
        for (const intake of this.intakeRepository.listByEmail(normalized)) {
            if (!(0, waba_campaign_intake_status_1.shouldCountCampaignIntakeCredits)(intake.status))
                continue;
            const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
            if (planned <= 0)
                continue;
            const apiKind = (0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake);
            consumedByApi[apiKind] += planned;
        }
        this.usageRepository.setConsumedByApi(normalized, consumedByApi);
    }
    sumConsumedFromIntakes(email) {
        const totals = { oficial: 0, alternativa: 0 };
        for (const intake of this.intakeRepository.listByEmail(email)) {
            if (!(0, waba_campaign_intake_status_1.shouldCountCampaignIntakeCredits)(intake.status))
                continue;
            const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
            if (planned <= 0)
                continue;
            totals[(0, waba_dispatches_api_kind_1.resolveIntakeApiKindFromIntake)(intake)] += planned;
        }
        return totals;
    }
    ensureUsageMigrated(email) {
        const normalized = normalizeEmail(email);
        const fromIntakes = this.sumConsumedFromIntakes(normalized);
        const intakeTotal = fromIntakes.oficial + fromIntakes.alternativa;
        if (intakeTotal <= 0)
            return;
        const repoOficial = this.usageRepository.getConsumedShipments(normalized, "oficial");
        const repoAlternativa = this.usageRepository.getConsumedShipments(normalized, "alternativa");
        const repoTotal = repoOficial + repoAlternativa;
        if (repoTotal !== intakeTotal ||
            (fromIntakes.alternativa > 0 && repoAlternativa === 0)) {
            this.rebuildConsumedByApiFromIntakes(normalized);
        }
    }
    buildApiBucket(email, apiKind, paidOrders, realPurchases) {
        const purchasesForApi = realPurchases.filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind);
        const contractedShipments = (0, waba_disparos_real_purchases_1.sumPurchasedShipments)(purchasesForApi);
        const consumedShipments = this.sumRealizedFromCampaigns(email, apiKind);
        const bonusContracted = paidOrders
            .filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind &&
            order.grantSource === "admin-bonus-envios" &&
            !(0, waba_disparos_real_purchases_1.isOperationalBalanceRepairOrder)(order))
            .reduce((sum, order) => sum + (0, waba_disparos_order_shipments_1.resolveActiveOrderShipmentCount)(order), 0);
        const remainingShipments = Math.max(0, contractedShipments - consumedShipments) + bonusContracted;
        const pendingBonusShipments = this.bonusService.getPendingBonusShipments(email, apiKind);
        const bucket = {
            contractedShipments,
            consumedShipments,
            remainingShipments,
            pendingBonusShipments,
        };
        (0, waba_cleison_oficial_balance_repair_1.applyCleisonOficialCreditsOverride)(email, apiKind, bucket);
        return bucket;
    }
    getPaidRemainingForApi(email, apiKind) {
        const purchases = this.listRealPurchasesForEmail(email).filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind);
        const contracted = (0, waba_disparos_real_purchases_1.sumPurchasedShipments)(purchases);
        const consumed = this.sumRealizedFromCampaigns(email, apiKind);
        const bonusContracted = this.listPaidOrdersForEmail(email)
            .filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind &&
            order.grantSource === "admin-bonus-envios" &&
            !(0, waba_disparos_real_purchases_1.isOperationalBalanceRepairOrder)(order))
            .reduce((sum, order) => sum + (0, waba_disparos_order_shipments_1.resolveActiveOrderShipmentCount)(order), 0);
        return Math.max(0, contracted - consumed) + bonusContracted;
    }
    getRemainingShipmentsForApi(email, apiKind) {
        return this.getCreditsSummary(email).byApi[apiKind].remainingShipments;
    }
    getCreditsSummary(email) {
        const normalized = this.prepareCreditsLedger(email);
        const unlimitedCredits = this.masterPolicyService.hasUnlimitedCredits(normalized);
        const paidOrders = this.listPaidOrdersForEmail(normalized);
        const realPurchases = this.listRealPurchasesForEmail(normalized);
        const byApi = {
            oficial: this.buildApiBucket(normalized, "oficial", paidOrders, realPurchases),
            alternativa: this.buildApiBucket(normalized, "alternativa", paidOrders, realPurchases),
        };
        if (unlimitedCredits) {
            for (const kind of ["oficial", "alternativa"]) {
                byApi[kind] = {
                    ...byApi[kind],
                    remainingShipments: UNLIMITED_CREDITS_REMAINING,
                };
            }
        }
        const contractedShipments = byApi.oficial.contractedShipments + byApi.alternativa.contractedShipments;
        const consumedShipments = byApi.oficial.consumedShipments + byApi.alternativa.consumedShipments;
        const remainingShipments = unlimitedCredits
            ? UNLIMITED_CREDITS_REMAINING
            : byApi.oficial.remainingShipments + byApi.alternativa.remainingShipments;
        const pendingBonusShipments = byApi.oficial.pendingBonusShipments + byApi.alternativa.pendingBonusShipments;
        const contractedValueCents = realPurchases.reduce((sum, order) => sum + Math.round(Number(order.valueCents ?? 0)), 0);
        const summary = {
            hasCredits: unlimitedCredits || contractedShipments > 0,
            unlimitedCredits,
            email: normalized,
            activeApiKind: (0, waba_dispatches_api_kind_1.resolveSubscriberDispatchesApiKindFromOrders)(normalized, this.orderRepository),
            byApi,
            contractedShipments,
            consumedShipments,
            remainingShipments,
            contractedValueCents,
            paidOrderCount: realPurchases.length,
            lastPaidAt: realPurchases[0]?.paidAt ?? "",
            pendingBonusShipments,
        };
        (0, waba_cleison_oficial_balance_repair_1.applyCleisonOficialSummaryOverride)(normalized, summary);
        return summary;
    }
    /**
     * Consome créditos (pago primeiro, depois bônus) e devolve o breakdown.
     * Usado na geração de campanha para gravar `creditFunding` e excluir bônus do split.
     */
    consumeShipments(email, delta = 1, apiKind = "oficial") {
        const normalized = normalizeEmail(email);
        const amount = Math.max(0, Math.round(Number(delta)));
        if (!normalized || amount <= 0)
            return { fromPaid: 0, fromBonus: 0 };
        const paidRemaining = this.getPaidRemainingForApi(normalized, apiKind);
        const fromPaid = Math.min(amount, paidRemaining);
        const fromBonus = amount - fromPaid;
        if (fromPaid > 0) {
            this.usageRepository.incrementConsumedShipments(normalized, fromPaid, apiKind);
        }
        if (fromBonus > 0) {
            this.usageRepository.incrementConsumedShipments(normalized, fromBonus, apiKind);
            this.usageRepository.incrementBonusConsumedShipments(normalized, fromBonus, apiKind);
        }
        return { fromPaid, fromBonus };
    }
    recordShipmentConsumed(email, delta = 1, apiKind = "oficial") {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return this.getCreditsSummary("");
        this.consumeShipments(normalized, delta, apiKind);
        return this.getCreditsSummary(normalized);
    }
    refreshConsumedFromIntakes(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return this.getCreditsSummary("");
        this.rebuildConsumedByApiFromIntakes(normalized);
        return this.getCreditsSummary(normalized);
    }
    isMasterUnlimited(email) {
        return this.masterPolicyService.hasUnlimitedCredits(normalizeEmail(email));
    }
    listPurchaseHistory(email, limit = 20) {
        const normalized = this.prepareCreditsLedger(email);
        const cap = Math.max(1, Math.min(50, Math.floor(limit)));
        return this.listRealPurchasesForEmail(normalized)
            .slice(0, cap)
            .map((order) => {
            const purchasedShipments = (0, waba_disparos_real_purchases_1.resolveRealPurchasedShipmentCount)(order);
            return {
                id: order.id,
                apiKind: (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order),
                valueCents: Math.max(0, Math.round(Number(order.valueCents ?? 0))),
                purchasedShipmentCount: purchasedShipments,
                shipmentCount: purchasedShipments,
                bonusShipmentsApplied: 0,
                paidAt: String(order.paidAt ?? ""),
            };
        });
    }
    listBonusHistory(email, limit = 20) {
        const normalized = this.prepareCreditsLedger(email);
        const cap = Math.max(1, Math.min(50, Math.floor(limit)));
        return this.bonusService.listBonusGrantHistory(normalized, cap);
    }
}
exports.WabaDisparosCreditsService = WabaDisparosCreditsService;
