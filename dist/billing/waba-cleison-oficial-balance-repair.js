"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCleisonOficialBalanceRepair = exports.CLEISON_VOID_1016_ADMIN_GRANTS_MARKER = exports.CLEISON_OFICIAL_FORCE_REF = exports.CLEISON_OFICIAL_PACK_SIZE = exports.CLEISON_OFICIAL_FORCED_REMAINING = exports.CLEISON_OFICIAL_TARGET_EMAIL = void 0;
exports.isCleisonOficialBalanceTarget = isCleisonOficialBalanceTarget;
exports.applyCleisonOficialCreditsOverride = applyCleisonOficialCreditsOverride;
exports.applyCleisonOficialSummaryOverride = applyCleisonOficialSummaryOverride;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const data_path_1 = require("../data-path");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
exports.CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
exports.CLEISON_OFICIAL_FORCED_REMAINING = 5829;
exports.CLEISON_OFICIAL_PACK_SIZE = 5000;
exports.CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";
exports.CLEISON_VOID_1016_ADMIN_GRANTS_MARKER = "waba-cleison-void-1016-admin-grants.json";
const DUPLICATE_1016_ADMIN_GRANT = 1016;
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
        this.voidDuplicate1016AdminGrantsOnce();
    }
    /**
     * Uma vez: desativa os bônus master 1016 vitalícios duplicados do Cleison.
     * Não mexe na compra Asaas nem no bônus de campanha liquidado nela.
     */
    voidDuplicate1016AdminGrantsOnce() {
        const markerPath = (0, data_path_1.resolveDataFile)(exports.CLEISON_VOID_1016_ADMIN_GRANTS_MARKER);
        if ((0, node_fs_1.existsSync)(markerPath))
            return;
        const now = new Date().toISOString();
        const orders = this.orderRepository.list();
        const voidedIds = [];
        for (const order of orders) {
            if (order.product !== "waba-disparos")
                continue;
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== "oficial")
                continue;
            if (normalizeEmail(order.ownerEmail) !== exports.CLEISON_OFICIAL_TARGET_EMAIL)
                continue;
            if (order.grantSource !== "admin-bonus-envios")
                continue;
            if (isForceBalanceOrder(order) || order.grantCreatedByEmail === "system-balance-repair")
                continue;
            if (order.grantActive === false)
                continue;
            if (Math.max(0, Math.round(Number(order.shipmentCount ?? 0))) !== DUPLICATE_1016_ADMIN_GRANT) {
                continue;
            }
            const lifetime = order.validityMode === "lifetime" || !String(order.creditsValidUntil ?? "").trim();
            if (!lifetime)
                continue;
            const createdMs = Date.parse(String(order.createdAt ?? ""));
            if (!Number.isFinite(createdMs) || createdMs >= Date.parse("2026-09-09T15:00:00.000Z")) {
                continue;
            }
            order.grantActive = false;
            order.updatedAt = now;
            voidedIds.push(order.id);
        }
        if (!voidedIds.length)
            return;
        this.orderRepository.replaceAll(orders);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(markerPath), { recursive: true });
        (0, node_fs_1.writeFileSync)(markerPath, JSON.stringify({ voidedAt: now, orderIds: voidedIds }, null, 2), "utf-8");
    }
    restoreOrdersDamagedByForceBalance() {
        const now = new Date().toISOString();
        const expiredUntil = new Date(Date.now() - 60000).toISOString();
        const orders = this.orderRepository.list();
        const supersededIds = this.collectSupersededOriginalPackIds(orders);
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
            if (supersededIds.has(order.id)) {
                if (this.expireSupersededPack(order, now, expiredUntil))
                    changed = true;
                continue;
            }
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
    /**
     * Pacote original (5.000) já representado pelo restante (1.849): não reativa.
     * Mantém só o PIX mais recente quando ele é posterior ao restante.
     */
    collectSupersededOriginalPackIds(orders) {
        const purchases = orders.filter((order) => {
            if (order.product !== "waba-disparos")
                return false;
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== "oficial")
                return false;
            if (normalizeEmail(order.ownerEmail) !== exports.CLEISON_OFICIAL_TARGET_EMAIL)
                return false;
            if (order.status !== "paid")
                return false;
            if (order.grantSource === "admin-bonus-envios")
                return false;
            if (isForceBalanceOrder(order) || order.grantCreatedByEmail === "system-balance-repair") {
                return false;
            }
            return String(order.paidAt ?? "").trim().length > 0;
        });
        const remainders = purchases.filter((order) => {
            const purchased = (0, waba_disparos_order_shipments_1.resolvePurchasedShipmentCount)(order);
            return purchased > 0 && purchased < exports.CLEISON_OFICIAL_PACK_SIZE;
        });
        if (!remainders.length)
            return new Set();
        const paidMs = (order) => {
            const ms = Date.parse(String(order.paidAt ?? order.createdAt ?? ""));
            return Number.isFinite(ms) ? ms : 0;
        };
        const packs = purchases
            .filter((order) => (0, waba_disparos_order_shipments_1.resolvePurchasedShipmentCount)(order) >= exports.CLEISON_OFICIAL_PACK_SIZE)
            .sort((a, b) => paidMs(b) - paidMs(a));
        const latestPack = packs[0];
        const latestIsNewPurchase = Boolean(latestPack && remainders.every((remainder) => paidMs(remainder) < paidMs(latestPack)));
        const keepId = latestIsNewPurchase && latestPack ? latestPack.id : "";
        return new Set(packs.filter((order) => order.id !== keepId).map((order) => order.id));
    }
    expireSupersededPack(order, now, expiredUntil) {
        if (!(0, waba_disparos_order_shipments_1.isOrderCreditsActive)(order) && order.grantActive === false && creditsUntilIsPast(order)) {
            return false;
        }
        order.grantActive = false;
        order.creditsValidUntil = expiredUntil;
        order.validityMode = "custom";
        order.bonusShipmentsApplied = 0;
        order.updatedAt = now;
        return true;
    }
}
exports.WabaCleisonOficialBalanceRepair = WabaCleisonOficialBalanceRepair;
