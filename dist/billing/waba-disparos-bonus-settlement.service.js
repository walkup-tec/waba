"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaDisparosBonusSettlementService = void 0;
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_bonus_service_1 = require("./waba-disparos-bonus.service");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const normalizeEmail = (value) => value.trim().toLowerCase();
/**
 * Na próxima compra paga de um plano, soma os créditos bonificados daquele plano
 * ao pedido e zera o saldo bonificado correspondente.
 */
class WabaDisparosBonusSettlementService {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), bonusService = new waba_disparos_bonus_service_1.WabaDisparosBonusService()) {
        this.orderRepository = orderRepository;
        this.bonusService = bonusService;
    }
    listPaidDisparosOrdersForEmail(email) {
        const normalized = normalizeEmail(email);
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos" &&
            order.status === "paid" &&
            normalizeEmail(order.ownerEmail) === normalized &&
            String(order.paidAt ?? "").trim().length > 0)
            .sort((a, b) => new Date(a.paidAt || a.updatedAt).getTime() -
            new Date(b.paidAt || b.updatedAt).getTime());
    }
    findBonusSettlementOrder(email, apiKind) {
        const pending = this.bonusService.getPendingBonusShipments(email, apiKind);
        if (pending <= 0)
            return null;
        const earliestGrantAt = this.bonusService.getEarliestGrantAt(email, apiKind);
        if (!earliestGrantAt)
            return null;
        const grantTime = new Date(earliestGrantAt).getTime();
        const eligible = this.listPaidDisparosOrdersForEmail(email).filter((order) => {
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== apiKind)
                return false;
            const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
            if (applied > 0)
                return false;
            const paidAt = String(order.paidAt ?? "").trim();
            if (!paidAt)
                return false;
            return new Date(paidAt).getTime() >= grantTime;
        });
        return eligible[0] ?? null;
    }
    canApplyPendingBonusToOrder(order) {
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const target = this.findBonusSettlementOrder(order.ownerEmail, apiKind);
        return target?.id === order.id;
    }
    settlePaidOrder(order) {
        if (order.product !== "waba-disparos" || order.status !== "paid")
            return order;
        const alreadyApplied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
        if (alreadyApplied > 0)
            return order;
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const totalShipments = (0, waba_disparos_order_shipments_1.resolveOrderShipmentCount)(order);
        const purchasedShipments = totalShipments - alreadyApplied;
        const now = new Date().toISOString();
        let bonusToApply = 0;
        if (this.canApplyPendingBonusToOrder(order)) {
            bonusToApply = this.bonusService.getPendingBonusShipments(order.ownerEmail, apiKind);
        }
        const hasSettlementMark = String(order.bonusSettlementAt ?? "").trim().length > 0;
        if (hasSettlementMark && bonusToApply <= 0)
            return order;
        return (this.orderRepository.update(order.id, {
            shipmentCount: purchasedShipments + bonusToApply,
            bonusShipmentsApplied: bonusToApply,
            bonusSettlementAt: now,
        }) ?? order);
    }
    settleAllUnsettledPaidOrdersForEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return;
        for (const order of this.listPaidDisparosOrdersForEmail(normalized)) {
            const fresh = this.orderRepository.getById(order.id);
            if (fresh)
                this.settlePaidOrder(fresh);
        }
    }
}
exports.WabaDisparosBonusSettlementService = WabaDisparosBonusSettlementService;
