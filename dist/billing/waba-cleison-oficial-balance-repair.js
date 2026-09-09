"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCleisonOficialBalanceRepair = exports.CLEISON_OFICIAL_FORCE_REF = exports.CLEISON_OFICIAL_FORCED_REMAINING = exports.CLEISON_OFICIAL_TARGET_EMAIL = void 0;
exports.isCleisonOficialBalanceTarget = isCleisonOficialBalanceTarget;
exports.applyCleisonOficialCreditsOverride = applyCleisonOficialCreditsOverride;
exports.applyCleisonOficialSummaryOverride = applyCleisonOficialSummaryOverride;
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
exports.CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
exports.CLEISON_OFICIAL_FORCED_REMAINING = 5829;
exports.CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";
const normalizeEmail = (value) => value.trim().toLowerCase();
const isForceBalanceOrder = (order) => String(order.asaasExternalReference ?? "").trim() === exports.CLEISON_OFICIAL_FORCE_REF;
const creditsUntilIsPast = (order, nowMs = Date.now()) => {
    const until = String(order.creditsValidUntil ?? "").trim();
    if (!until)
        return false;
    const untilMs = Date.parse(until);
    return Number.isFinite(untilMs) && untilMs < nowMs;
};
const asaasPaymentLooksPending = (order) => {
    const status = String(order.asaasPaymentStatus ?? "").trim().toUpperCase();
    return (status === "PENDING" ||
        status === "AWAITING" ||
        status === "AWAITING_PAYMENT" ||
        status === "OVERDUE" ||
        status === "PAYMENT_OVERDUE");
};
function isCleisonOficialBalanceTarget(email) {
    return normalizeEmail(email) === exports.CLEISON_OFICIAL_TARGET_EMAIL;
}
/** Overlay 5829/0 removido: compras Asaas e grant master precisam contar de verdade. */
function applyCleisonOficialCreditsOverride(_email, _apiKind, _bucket) { }
function applyCleisonOficialSummaryOverride(_email, _summary) { }
/**
 * Desfaz o congelamento operacional 5829/0 que expirava compras pagas e grants master.
 */
class WabaCleisonOficialBalanceRepair {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) {
        this.orderRepository = orderRepository;
    }
    applyIfNeeded(email) {
        if (!isCleisonOficialBalanceTarget(email))
            return;
        this.restoreOrdersDamagedByForceBalance();
    }
    restoreOrdersDamagedByForceBalance() {
        const now = new Date().toISOString();
        const expiredUntil = new Date(Date.now() - 60000).toISOString();
        const orders = this.orderRepository.list();
        let changed = false;
        for (const order of orders) {
            if (order.product !== "waba-disparos")
                continue;
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== "oficial")
                continue;
            if (normalizeEmail(order.ownerEmail) !== exports.CLEISON_OFICIAL_TARGET_EMAIL)
                continue;
            if (isForceBalanceOrder(order) || order.grantCreatedByEmail === "system-balance-repair") {
                const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
                if (order.grantActive !== false || !creditsUntilIsPast(order) || applied > 0) {
                    order.grantActive = false;
                    order.creditsValidUntil = expiredUntil;
                    order.validityMode = "custom";
                    order.bonusShipmentsApplied = 0;
                    order.updatedAt = now;
                    changed = true;
                }
                continue;
            }
            if (order.status !== "paid")
                continue;
            const untilPast = creditsUntilIsPast(order);
            const grantKilled = order.grantSource === "admin-bonus-envios" && order.grantActive === false && untilPast;
            const purchaseKilled = order.grantSource !== "admin-bonus-envios" && untilPast && !asaasPaymentLooksPending(order);
            if (!grantKilled && !purchaseKilled)
                continue;
            order.grantActive = true;
            order.creditsValidUntil = null;
            order.validityMode = "lifetime";
            order.updatedAt = now;
            changed = true;
        }
        if (changed)
            this.orderRepository.replaceAll(orders);
    }
}
exports.WabaCleisonOficialBalanceRepair = WabaCleisonOficialBalanceRepair;
