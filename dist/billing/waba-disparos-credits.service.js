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
const waba_disparos_credit_usage_repository_1 = require("./waba-disparos-credit-usage.repository");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_campaign_intake_status_1 = require("../disparos/waba-campaign-intake-status");
const normalizeEmail = (value) => value.trim().toLowerCase();
const UNLIMITED_CREDITS_REMAINING = 9999999;
class WabaDisparosCreditsService {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), usageRepository = new waba_disparos_credit_usage_repository_1.WabaDisparosCreditUsageRepository(), bonusService = new waba_disparos_bonus_service_1.WabaDisparosBonusService(), bonusSettlementService = new waba_disparos_bonus_settlement_service_1.WabaDisparosBonusSettlementService(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), masterPolicyService = new waba_master_disparos_policy_service_1.WabaMasterDisparosPolicyService()) {
        this.orderRepository = orderRepository;
        this.usageRepository = usageRepository;
        this.bonusService = bonusService;
        this.bonusSettlementService = bonusSettlementService;
        this.intakeRepository = intakeRepository;
        this.masterPolicyService = masterPolicyService;
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
    buildApiBucket(email, apiKind, paidOrders) {
        const ordersForApi = paidOrders.filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind);
        const paidContracted = ordersForApi
            .filter((order) => order.grantSource !== "admin-bonus-envios")
            .reduce((sum, order) => sum + (0, waba_disparos_order_shipments_1.resolveActiveOrderShipmentCount)(order), 0);
        const bonusContracted = ordersForApi
            .filter((order) => order.grantSource === "admin-bonus-envios")
            .reduce((sum, order) => sum + (0, waba_disparos_order_shipments_1.resolveActiveOrderShipmentCount)(order), 0);
        const contractedShipments = paidContracted + bonusContracted;
        const consumedShipments = this.usageRepository.getConsumedShipments(email, apiKind);
        const bonusConsumedShipments = this.usageRepository.getBonusConsumedShipments(email, apiKind);
        // Dívida antiga NÃO reduz bônus admin. Disponível = remanescente pago + bônus ainda não usado.
        const remainingPaid = Math.max(0, paidContracted - consumedShipments);
        const remainingBonus = Math.max(0, bonusContracted - bonusConsumedShipments);
        const remainingShipments = remainingPaid + remainingBonus;
        const pendingBonusShipments = this.bonusService.getPendingBonusShipments(email, apiKind);
        return {
            contractedShipments,
            consumedShipments,
            remainingShipments,
            pendingBonusShipments,
        };
    }
    getPaidRemainingForApi(email, apiKind) {
        const paidOrders = this.listPaidOrdersForEmail(email).filter((order) => (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind && order.grantSource !== "admin-bonus-envios");
        const paidContracted = paidOrders.reduce((sum, order) => sum + (0, waba_disparos_order_shipments_1.resolveActiveOrderShipmentCount)(order), 0);
        const consumedShipments = this.usageRepository.getConsumedShipments(email, apiKind);
        return Math.max(0, paidContracted - consumedShipments);
    }
    getRemainingShipmentsForApi(email, apiKind) {
        return this.getCreditsSummary(email).byApi[apiKind].remainingShipments;
    }
    getCreditsSummary(email) {
        const normalized = normalizeEmail(email);
        const unlimitedCredits = this.masterPolicyService.hasUnlimitedCredits(normalized);
        this.ensureUsageMigrated(normalized);
        this.bonusSettlementService.settleAllUnsettledPaidOrdersForEmail(normalized);
        const paidOrders = this.listPaidOrdersForEmail(normalized);
        const byApi = {
            oficial: this.buildApiBucket(normalized, "oficial", paidOrders),
            alternativa: this.buildApiBucket(normalized, "alternativa", paidOrders),
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
        const contractedValueCents = paidOrders.reduce((sum, order) => sum + Math.round(Number(order.valueCents ?? 0)), 0);
        return {
            hasCredits: unlimitedCredits || contractedShipments > 0,
            unlimitedCredits,
            email: normalized,
            activeApiKind: (0, waba_dispatches_api_kind_1.resolveSubscriberDispatchesApiKindFromOrders)(normalized, this.orderRepository),
            byApi,
            contractedShipments,
            consumedShipments,
            remainingShipments,
            contractedValueCents,
            paidOrderCount: paidOrders.length,
            lastPaidAt: paidOrders[0]?.paidAt ?? "",
            pendingBonusShipments,
        };
    }
    recordShipmentConsumed(email, delta = 1, apiKind = "oficial") {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return this.getCreditsSummary("");
        const amount = Math.max(0, Math.round(Number(delta)));
        if (amount <= 0)
            return this.getCreditsSummary(normalized);
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
        const cap = Math.max(1, Math.min(50, Math.floor(limit)));
        return this.listPaidOrdersForEmail(email)
            .slice(0, cap)
            .map((order) => ({
            id: order.id,
            apiKind: (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order),
            valueCents: Math.max(0, Math.round(Number(order.valueCents ?? 0))),
            shipmentCount: (0, waba_disparos_order_shipments_1.resolveOrderShipmentCount)(order),
            bonusShipmentsApplied: Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))),
            paidAt: String(order.paidAt ?? ""),
        }));
    }
    listBonusHistory(email, limit = 20) {
        const cap = Math.max(1, Math.min(50, Math.floor(limit)));
        return this.bonusService.listBonusGrantHistory(email, cap);
    }
}
exports.WabaDisparosCreditsService = WabaDisparosCreditsService;
