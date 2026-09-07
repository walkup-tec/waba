"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCleisonOficialBalanceRepair = exports.CLEISON_OFICIAL_FORCE_REF = exports.CLEISON_OFICIAL_FORCED_REMAINING = exports.CLEISON_OFICIAL_TARGET_EMAIL = void 0;
exports.isCleisonOficialBalanceTarget = isCleisonOficialBalanceTarget;
exports.applyCleisonOficialCreditsOverride = applyCleisonOficialCreditsOverride;
exports.applyCleisonOficialSummaryOverride = applyCleisonOficialSummaryOverride;
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
/** Tela Saldos: Disponíveis=5829 e Bonificados=0. Sem descontar consumo antigo. */
function applyCleisonOficialCreditsOverride(email, apiKind, bucket) {
    if (isRepairSkipped())
        return;
    if (apiKind !== "oficial")
        return;
    if (!isCleisonOficialBalanceTarget(email))
        return;
    bucket.remainingShipments = exports.CLEISON_OFICIAL_FORCED_REMAINING;
    bucket.pendingBonusShipments = 0;
}
function applyCleisonOficialSummaryOverride(email, summary) {
    if (isRepairSkipped())
        return;
    const target = isCleisonOficialBalanceTarget(email) || isCleisonOficialBalanceTarget(summary.email ?? "");
    if (!target)
        return;
    if (!summary.byApi?.oficial)
        return;
    summary.byApi.oficial.remainingShipments = exports.CLEISON_OFICIAL_FORCED_REMAINING;
    summary.byApi.oficial.pendingBonusShipments = 0;
    summary.remainingShipments =
        summary.byApi.oficial.remainingShipments +
            Number(summary.byApi.alternativa?.remainingShipments ?? 0);
    summary.pendingBonusShipments =
        summary.byApi.oficial.pendingBonusShipments +
            Number(summary.byApi.alternativa?.pendingBonusShipments ?? 0);
}
/**
 * Ajuste operacional: Disponível Oficial = 5.829 e Bonificados = 0.
 * Grava o JSON de pedidos numa única escrita.
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
        const now = new Date().toISOString();
        const until = new Date(Date.now() - 60000).toISOString();
        const granted = this.bonusRepository.getGrantedShipments(exports.CLEISON_OFICIAL_TARGET_EMAIL, "oficial");
        const orders = this.orderRepository.list();
        const official = orders.filter((order) => order.product === "waba-disparos" &&
            (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === "oficial" &&
            normalizeEmail(order.ownerEmail) === exports.CLEISON_OFICIAL_TARGET_EMAIL);
        let force = official.find((order) => String(order.asaasExternalReference ?? "").trim() === exports.CLEISON_OFICIAL_FORCE_REF) ?? null;
        if (!force) {
            const existing = official[0];
            force = {
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
                bonusShipmentsApplied: granted,
                bonusSettlementAt: now,
                grantSource: "admin-bonus-envios",
                grantCreatedByEmail: "system-balance-repair",
                grantActive: true,
                creditsValidUntil: null,
                validityMode: "lifetime",
            };
            orders.push(force);
        }
        const forceId = force.id;
        const alreadyApplied = Math.max(0, Math.round(Number(force.bonusShipmentsApplied ?? 0)));
        for (const order of orders) {
            if (order.id === forceId) {
                order.status = "paid";
                order.paidAt = String(order.paidAt ?? now);
                order.shipmentCount = exports.CLEISON_OFICIAL_FORCED_REMAINING;
                order.grantSource = "admin-bonus-envios";
                order.grantCreatedByEmail = "system-balance-repair";
                order.grantActive = true;
                order.creditsValidUntil = null;
                order.validityMode = "lifetime";
                order.bonusSettlementAt = now;
                order.bonusShipmentsApplied = Math.max(granted, alreadyApplied);
                order.asaasExternalReference = exports.CLEISON_OFICIAL_FORCE_REF;
                order.apiKind = "oficial";
                order.ownerEmail = exports.CLEISON_OFICIAL_TARGET_EMAIL;
                order.updatedAt = now;
                continue;
            }
            if (order.product !== "waba-disparos")
                continue;
            if ((0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) !== "oficial")
                continue;
            if (normalizeEmail(order.ownerEmail) !== exports.CLEISON_OFICIAL_TARGET_EMAIL)
                continue;
            if (String(order.asaasExternalReference ?? "").trim() === exports.CLEISON_OFICIAL_FORCE_REF)
                continue;
            if (order.status === "pending_payment") {
                order.status = "paid";
                order.paidAt = now;
                order.creditsValidUntil = until;
                order.validityMode = "custom";
                order.grantActive = false;
                order.bonusSettlementAt = now;
                order.bonusShipmentsApplied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
                order.updatedAt = now;
                continue;
            }
            if (order.status === "paid") {
                order.creditsValidUntil = until;
                order.validityMode = "custom";
                order.grantActive = false;
                order.updatedAt = now;
            }
        }
        this.orderRepository.replaceAll(orders);
    }
}
exports.WabaCleisonOficialBalanceRepair = WabaCleisonOficialBalanceRepair;
