"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaDisparosBonusSettlementService = void 0;
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_bonus_service_1 = require("./waba-disparos-bonus.service");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const normalizeEmail = (value) => value.trim().toLowerCase();
const parseTime = (value) => {
    const ms = Date.parse(String(value || "").trim());
    return Number.isFinite(ms) ? ms : Number.NaN;
};
/**
 * Na próxima compra paga de um plano, soma os créditos bonificados daquele plano
 * ao pedido e zera o saldo bonificado correspondente.
 *
 * Bônus de campanha concluída ANTES do pagamento entra nessa compra — mesmo que o
 * pedido já tenha liquidado um lote parcial, ou o grant tenha sido gravado depois.
 * Bônus posterior à última compra permanece pendente até a próxima.
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
    listActivePaidPurchases(email, apiKind) {
        return this.listPaidDisparosOrdersForEmail(email).filter((order) => {
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== apiKind)
                return false;
            if (order.grantSource === "admin-bonus-envios")
                return false;
            if (!(0, waba_disparos_order_shipments_1.isOrderCreditsActive)(order))
                return false;
            return Number.isFinite(parseTime(String(order.paidAt ?? order.createdAt ?? "")));
        });
    }
    listEligiblePurchases(email, apiKind) {
        const active = this.listActivePaidPurchases(email, apiKind);
        return active.filter((order) => !(0, waba_disparos_order_shipments_1.isPriorRemainderBalanceOrder)(order, active));
    }
    listRemainderBalanceOrders(email, apiKind) {
        const active = this.listActivePaidPurchases(email, apiKind);
        return active.filter((order) => (0, waba_disparos_order_shipments_1.isPriorRemainderBalanceOrder)(order, active));
    }
    /**
     * Cada grant vai para a primeira compra paga (ativa, não-admin) cujo paidAt
     * é posterior ou igual à data da campanha.
     */
    assignGrantsToPurchases(email, apiKind) {
        const grants = this.bonusService.listGrantsForApi(email, apiKind);
        const purchases = this.listEligiblePurchases(email, apiKind);
        const assigned = new Map();
        for (const grant of grants) {
            const amount = Math.max(0, Math.round(Number(grant.shipments ?? 0)));
            if (amount <= 0)
                continue;
            const grantMs = parseTime(grant.grantedAt);
            const target = purchases.find((order) => {
                const paidMs = parseTime(String(order.paidAt ?? order.createdAt ?? ""));
                if (!Number.isFinite(paidMs))
                    return false;
                if (!Number.isFinite(grantMs))
                    return true;
                return paidMs >= grantMs;
            });
            if (!target)
                continue;
            assigned.set(target.id, (assigned.get(target.id) ?? 0) + amount);
        }
        return assigned;
    }
    settlePaidOrder(order) {
        if (order.product !== "waba-disparos" || order.status !== "paid")
            return order;
        if (order.grantSource === "admin-bonus-envios")
            return order;
        const apiKind = (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order);
        const grants = this.bonusService.listGrantsForApi(order.ownerEmail, apiKind);
        const assigned = this.assignGrantsToPurchases(order.ownerEmail, apiKind).get(order.id) ?? 0;
        const purchasedShipments = (0, waba_disparos_order_shipments_1.resolvePurchasedShipmentCount)(order);
        const alreadyApplied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
        // Fonte da verdade: grants atribuídos a esta compra. Permite baixar se o
        // bônus posterior (ex.: PTX) entrou no disponível por engano. Sem grants
        // no store, não zera liquidação já gravada.
        const nextApplied = grants.length === 0 ? alreadyApplied : assigned;
        const nextCount = purchasedShipments + nextApplied;
        const hasPurchased = Math.round(Number(order.purchasedShipmentCount ?? 0)) > 0;
        if (nextApplied === alreadyApplied &&
            Math.max(0, Math.round(Number(order.shipmentCount ?? 0))) === nextCount &&
            hasPurchased) {
            return order;
        }
        const now = new Date().toISOString();
        return (this.orderRepository.update(order.id, {
            purchasedShipmentCount: purchasedShipments,
            shipmentCount: nextCount,
            bonusShipmentsApplied: nextApplied,
            bonusSettlementAt: now,
        }) ?? order);
    }
    clearBonusFromRemainderOrders(email, apiKind) {
        const now = new Date().toISOString();
        for (const order of this.listRemainderBalanceOrders(email, apiKind)) {
            const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
            const purchased = (0, waba_disparos_order_shipments_1.resolvePurchasedShipmentCount)(order);
            if (applied <= 0 && Math.max(0, Math.round(Number(order.shipmentCount ?? 0))) === purchased) {
                continue;
            }
            this.orderRepository.update(order.id, {
                purchasedShipmentCount: purchased,
                shipmentCount: purchased,
                bonusShipmentsApplied: 0,
                bonusSettlementAt: now,
            });
        }
    }
    settleAllUnsettledPaidOrdersForEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return;
        for (const kind of ["oficial", "alternativa"]) {
            this.clearBonusFromRemainderOrders(normalized, kind);
            const assigned = this.assignGrantsToPurchases(normalized, kind);
            const purchases = this.listEligiblePurchases(normalized, kind);
            for (const order of purchases) {
                if ((assigned.get(order.id) ?? 0) <= 0 && Math.round(Number(order.bonusShipmentsApplied ?? 0)) <= 0) {
                    continue;
                }
                const fresh = this.orderRepository.getById(order.id);
                if (fresh)
                    this.settlePaidOrder(fresh);
            }
        }
    }
}
exports.WabaDisparosBonusSettlementService = WabaDisparosBonusSettlementService;
