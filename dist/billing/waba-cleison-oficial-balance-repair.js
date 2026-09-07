"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCleisonOficialBalanceRepair = exports.CLEISON_OFICIAL_FORCE_REF = exports.CLEISON_OFICIAL_FORCED_REMAINING = exports.CLEISON_OFICIAL_TARGET_EMAIL = void 0;
exports.isCleisonOficialBalanceTarget = isCleisonOficialBalanceTarget;
exports.applyCleisonOficialCreditsOverride = applyCleisonOficialCreditsOverride;
const node_crypto_1 = require("node:crypto");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const waba_disparos_bonus_repository_1 = require("./waba-disparos-bonus.repository");
const waba_disparos_bonus_service_1 = require("./waba-disparos-bonus.service");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
exports.CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
exports.CLEISON_OFICIAL_FORCED_REMAINING = 5829;
exports.CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";
const normalizeEmail = (value) => value.trim().toLowerCase();
const isRepairSkipped = () => String(process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR ?? "").trim() === "1";
function isCleisonOficialBalanceTarget(email) {
    return normalizeEmail(email) === exports.CLEISON_OFICIAL_TARGET_EMAIL;
}
/** A tela Saldos lê este bucket. Trava Disponível=5829 e Bonificados=0 para o Cleison. */
function applyCleisonOficialCreditsOverride(email, apiKind, bucket, bonusConsumedShipments = 0) {
    if (isRepairSkipped())
        return;
    if (apiKind !== "oficial")
        return;
    if (!isCleisonOficialBalanceTarget(email))
        return;
    const consumed = Math.max(0, Math.round(Number(bonusConsumedShipments ?? 0)));
    bucket.remainingShipments = Math.max(0, exports.CLEISON_OFICIAL_FORCED_REMAINING - consumed);
    bucket.pendingBonusShipments = 0;
}
/**
 * Ajuste operacional: Disponível Oficial = 5.829 e Bonificados = 0.
 * Cura o grant forçado a cada GET (o ajuste anterior parava se o pedido já existisse).
 * Absorve Jandira + Jandira 2 para o pending não voltar no sync de campanha.
 */
class WabaCleisonOficialBalanceRepair {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), bonusRepository = new waba_disparos_bonus_repository_1.WabaDisparosBonusRepository(), bonusService = new waba_disparos_bonus_service_1.WabaDisparosBonusService()) {
        this.orderRepository = orderRepository;
        this.bonusRepository = bonusRepository;
        this.bonusService = bonusService;
    }
    applyIfNeeded(email) {
        if (isRepairSkipped())
            return;
        if (!isCleisonOficialBalanceTarget(email))
            return;
        this.bonusService.syncPendingBonusFromCompletedCampaigns(exports.CLEISON_OFICIAL_TARGET_EMAIL);
        const forceOrder = this.ensureForceOrder();
        this.expireOtherOfficialOrders(forceOrder.id);
        this.neutralizePendingOfficialCheckouts(forceOrder.id);
        this.healForceOrder(forceOrder.id);
    }
    listOfficialOrders() {
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos" &&
            (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === "oficial" &&
            normalizeEmail(order.ownerEmail) === exports.CLEISON_OFICIAL_TARGET_EMAIL);
    }
    findForceOrder() {
        return (this.listOfficialOrders().find((order) => String(order.asaasExternalReference ?? "").trim() === exports.CLEISON_OFICIAL_FORCE_REF) ?? null);
    }
    expireAt() {
        return new Date(Date.now() - 60000).toISOString();
    }
    grantedOfficialBonus() {
        return this.bonusRepository.getGrantedShipments(exports.CLEISON_OFICIAL_TARGET_EMAIL, "oficial");
    }
    ensureForceOrder() {
        const existing = this.findForceOrder();
        if (existing)
            return existing;
        return this.createForceOrder();
    }
    expireOtherOfficialOrders(keepId) {
        const until = this.expireAt();
        for (const order of this.listOfficialOrders()) {
            if (order.id === keepId)
                continue;
            if (String(order.asaasExternalReference ?? "").trim() === exports.CLEISON_OFICIAL_FORCE_REF)
                continue;
            if (order.status !== "paid")
                continue;
            this.orderRepository.update(order.id, {
                creditsValidUntil: until,
                validityMode: "custom",
                grantActive: false,
            });
        }
    }
    neutralizePendingOfficialCheckouts(keepId) {
        const until = this.expireAt();
        const now = new Date().toISOString();
        for (const order of this.listOfficialOrders()) {
            if (order.id === keepId)
                continue;
            if (order.status !== "pending_payment")
                continue;
            this.orderRepository.update(order.id, {
                status: "paid",
                paidAt: now,
                creditsValidUntil: until,
                validityMode: "custom",
                grantActive: false,
                bonusSettlementAt: now,
                bonusShipmentsApplied: Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))),
            });
        }
    }
    healForceOrder(forceId) {
        const now = new Date().toISOString();
        const current = this.orderRepository.getById(forceId);
        if (!current)
            return;
        const granted = this.grantedOfficialBonus();
        const alreadyApplied = Math.max(0, Math.round(Number(current.bonusShipmentsApplied ?? 0)));
        this.orderRepository.update(forceId, {
            status: "paid",
            paidAt: String(current.paidAt ?? now),
            shipmentCount: exports.CLEISON_OFICIAL_FORCED_REMAINING,
            grantSource: "admin-bonus-envios",
            grantCreatedByEmail: "system-balance-repair",
            grantActive: true,
            creditsValidUntil: null,
            validityMode: "lifetime",
            bonusSettlementAt: now,
            bonusShipmentsApplied: Math.max(granted, alreadyApplied),
            asaasExternalReference: exports.CLEISON_OFICIAL_FORCE_REF,
        });
    }
    createForceOrder() {
        const now = new Date().toISOString();
        const existing = this.listOfficialOrders()[0];
        const order = {
            id: (0, node_crypto_1.randomUUID)(),
            product: "waba-disparos",
            apiKind: "oficial",
            customerName: String(existing?.customerName || "Cleison").trim() || "Cleison",
            ownerEmail: exports.CLEISON_OFICIAL_TARGET_EMAIL,
            whatsapp: String(existing?.whatsapp || "").trim(),
            cpfCnpj: String(existing?.cpfCnpj || "").trim(),
            billingType: "PIX",
            valueCents: 0,
            shipmentCount: exports.CLEISON_OFICIAL_FORCED_REMAINING,
            status: "paid",
            asaasExternalReference: exports.CLEISON_OFICIAL_FORCE_REF,
            createdAt: now,
            updatedAt: now,
            paidAt: now,
            bonusShipmentsApplied: this.grantedOfficialBonus(),
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
