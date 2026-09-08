"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaIndicatorCommissionService = void 0;
const node_crypto_1 = require("node:crypto");
const asaas_identifiers_1 = require("../billing/asaas-identifiers");
const waba_money_cents_1 = require("../billing/waba-money-cents");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_indicator_audit_repository_1 = require("./waba-indicator-audit.repository");
const waba_indicator_commission_repository_1 = require("./waba-indicator-commission.repository");
class WabaIndicatorCommissionService {
    constructor(commissionRepository = new waba_indicator_commission_repository_1.WabaIndicatorCommissionRepository(), subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), auditRepository = new waba_indicator_audit_repository_1.WabaIndicatorAuditRepository()) {
        this.commissionRepository = commissionRepository;
        this.subscriberRepository = subscriberRepository;
        this.auditRepository = auditRepository;
    }
    getByOrderId(orderId) {
        return this.commissionRepository.getByOrderId(orderId);
    }
    ensureForPaidOrder(order) {
        if (order.product !== "waba-disparos" || order.status !== "paid")
            return null;
        if (order.grantSource === "admin-bonus-envios")
            return null;
        const indicatorUserId = String(order.indicatorUserId ?? "").trim();
        const spreadAmountCents = (0, waba_money_cents_1.toNonNegativeCents)(order.spreadAmountCents);
        const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
        const total = Math.max(0, Math.round(Number(order.shipmentCount ?? 0)));
        const quantity = Math.max(0, Math.round(Number(order.purchasedShipmentCount ??
            (bonus > 0 && total > bonus ? total - bonus : total))));
        if (!indicatorUserId || spreadAmountCents <= 0 || quantity <= 0)
            return null;
        const subscriber = this.subscriberRepository.getByEmail(String(order.ownerEmail ?? "").trim().toLowerCase()) ||
            this.subscriberRepository.list().find((item) => item.indicatorUserId === indicatorUserId) ||
            null;
        const now = new Date().toISOString();
        const { commission, created } = this.commissionRepository.createIfAbsent({
            id: (0, node_crypto_1.randomUUID)(),
            indicatorUserId,
            subscriberId: subscriber?.id ?? "",
            subscriberEmail: String(order.ownerEmail ?? "").trim().toLowerCase(),
            orderId: order.id,
            asaasPaymentId: String(order.asaasPaymentId ?? "").trim(),
            campaignId: "",
            quantity,
            baseUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(order.baseUnitPriceCents),
            spreadUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(order.spreadUnitPriceCents),
            customerUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(order.customerUnitPriceCents),
            baseAmountCents: (0, waba_money_cents_1.toNonNegativeCents)(order.baseAmountCents),
            commissionAmountCents: spreadAmountCents,
            totalAmountCents: (0, waba_money_cents_1.toNonNegativeCents)(order.listValueCents ?? order.valueCents),
            status: "pending",
            payoutExternalReference: (0, asaas_identifiers_1.buildSplitLineAsaasExternalReference)({
                orderId: order.id,
                lineKind: "indicator",
                participantId: indicatorUserId,
            }),
            asaasTransferId: "",
            transactionReceiptUrl: "",
            failureReason: "",
            createdAt: now,
            updatedAt: now,
            paidAt: "",
            canceledAt: "",
        });
        if (created) {
            this.auditRepository.append({
                actorUserId: "",
                actorEmail: "asaas-webhook",
                action: "commission.created",
                entityType: "commission",
                entityId: commission.id,
                previousValue: null,
                nextValue: {
                    orderId: order.id,
                    commissionAmountCents: commission.commissionAmountCents,
                    spreadUnitPriceCents: commission.spreadUnitPriceCents,
                },
            });
        }
        return commission;
    }
    syncFromPayout(input) {
        const current = this.commissionRepository.getByOrderId(input.orderId);
        if (!current || current.status === "canceled")
            return current;
        if (input.status === "skipped")
            return current;
        const mapped = input.status === "paid"
            ? "paid"
            : input.status === "failed"
                ? "failed"
                : input.status === "processing"
                    ? "processing"
                    : "pending";
        if (current.status === "paid" && mapped !== "paid")
            return current;
        const updated = this.commissionRepository.updateById(current.id, {
            status: mapped,
            asaasTransferId: input.asaasTransferId || current.asaasTransferId,
            transactionReceiptUrl: input.transactionReceiptUrl || current.transactionReceiptUrl,
            failureReason: mapped === "failed" ? String(input.failureReason ?? "") : "",
            paidAt: mapped === "paid" ? input.paidAt || current.paidAt || new Date().toISOString() : current.paidAt,
        });
        if (updated && mapped !== current.status) {
            this.auditRepository.append({
                actorUserId: "",
                actorEmail: "asaas-transfer",
                action: mapped === "paid" ? "commission.paid" : mapped === "failed" ? "commission.failed" : "commission.updated",
                entityType: "commission",
                entityId: updated.id,
                previousValue: { status: current.status },
                nextValue: { status: updated.status, asaasTransferId: updated.asaasTransferId },
            });
        }
        return updated;
    }
    cancelForReversedPayment(orderId, reason) {
        const current = this.commissionRepository.getByOrderId(orderId);
        if (!current || current.status === "canceled")
            return current;
        const updated = this.commissionRepository.updateById(current.id, {
            status: "canceled",
            canceledAt: new Date().toISOString(),
            failureReason: reason,
        });
        if (updated) {
            this.auditRepository.append({
                actorUserId: "",
                actorEmail: "asaas-webhook",
                action: "commission.canceled",
                entityType: "commission",
                entityId: updated.id,
                previousValue: { status: current.status },
                nextValue: { status: "canceled", reason },
            });
        }
        return updated;
    }
}
exports.WabaIndicatorCommissionService = WabaIndicatorCommissionService;
