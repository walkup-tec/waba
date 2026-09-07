"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCleisonOficialBalanceRepair = void 0;
const node_crypto_1 = require("node:crypto");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const TARGET_EMAIL = "cleison.fel@gmail.com";
const TARGET_REMAINING = 5829;
const FORCE_REF = "waba:force-balance:cleison-oficial-5829";
const BONUS_TO_APPLY = 829;
const normalizeEmail = (value) => value.trim().toLowerCase();
const isRepairSkipped = () => String(process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR ?? "").trim() === "1";
/**
 * Ajuste operacional único: disponível Oficial = 5.829 e Bonificados = 0.
 * O PIX antigo não deve somar de novo depois (outros pedidos Oficiais ativos expiram).
 */
class WabaCleisonOficialBalanceRepair {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) {
        this.orderRepository = orderRepository;
    }
    applyIfNeeded(email) {
        if (isRepairSkipped())
            return;
        if (normalizeEmail(email) !== TARGET_EMAIL)
            return;
        const forceOrder = this.findForceOrder();
        if (forceOrder) {
            this.expireOtherOfficialOrders(forceOrder.id);
            this.neutralizePendingOfficialCheckouts(forceOrder.id);
            return;
        }
        this.expireOtherOfficialOrders("");
        this.neutralizePendingOfficialCheckouts("");
        this.createForceOrder();
    }
    listOfficialOrders() {
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos" &&
            (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === "oficial" &&
            normalizeEmail(order.ownerEmail) === TARGET_EMAIL);
    }
    findForceOrder() {
        return (this.listOfficialOrders().find((order) => String(order.asaasExternalReference ?? "").trim() === FORCE_REF) ?? null);
    }
    expireAt() {
        return new Date(Date.now() - 60000).toISOString();
    }
    expireOtherOfficialOrders(keepId) {
        const until = this.expireAt();
        for (const order of this.listOfficialOrders()) {
            if (keepId && order.id === keepId)
                continue;
            if (order.status !== "paid")
                continue;
            if (!(0, waba_disparos_order_shipments_1.isOrderCreditsActive)(order))
                continue;
            this.orderRepository.update(order.id, {
                creditsValidUntil: until,
                validityMode: "custom",
            });
        }
    }
    neutralizePendingOfficialCheckouts(keepId) {
        const until = this.expireAt();
        const now = new Date().toISOString();
        for (const order of this.listOfficialOrders()) {
            if (keepId && order.id === keepId)
                continue;
            if (order.status !== "pending_payment")
                continue;
            this.orderRepository.update(order.id, {
                status: "paid",
                paidAt: now,
                creditsValidUntil: until,
                validityMode: "custom",
                bonusSettlementAt: now,
                bonusShipmentsApplied: Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))),
            });
        }
    }
    createForceOrder() {
        const now = new Date().toISOString();
        const existing = this.listOfficialOrders()[0];
        const order = {
            id: (0, node_crypto_1.randomUUID)(),
            product: "waba-disparos",
            apiKind: "oficial",
            customerName: String(existing?.customerName || "Cleison").trim() || "Cleison",
            ownerEmail: TARGET_EMAIL,
            whatsapp: String(existing?.whatsapp || "").trim(),
            cpfCnpj: String(existing?.cpfCnpj || "").trim(),
            billingType: "PIX",
            valueCents: 0,
            shipmentCount: TARGET_REMAINING,
            status: "paid",
            asaasExternalReference: FORCE_REF,
            createdAt: now,
            updatedAt: now,
            paidAt: now,
            bonusShipmentsApplied: BONUS_TO_APPLY,
            bonusSettlementAt: now,
            grantSource: "admin-bonus-envios",
            grantCreatedByEmail: "system-balance-repair",
            grantActive: true,
            creditsValidUntil: null,
            validityMode: "lifetime",
        };
        return this.orderRepository.create(order);
    }
}
exports.WabaCleisonOficialBalanceRepair = WabaCleisonOficialBalanceRepair;
