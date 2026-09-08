import { randomUUID } from "node:crypto";
import { buildSplitLineAsaasExternalReference } from "../billing/asaas-identifiers";
import { toNonNegativeCents } from "../billing/waba-money-cents";
import type { WabaBillingOrder } from "../billing/waba-billing-order.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaIndicatorAuditRepository } from "./waba-indicator-audit.repository";
import { WabaIndicatorCommissionRepository } from "./waba-indicator-commission.repository";

export class WabaIndicatorCommissionService {
  constructor(
    private readonly commissionRepository = new WabaIndicatorCommissionRepository(),
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly auditRepository = new WabaIndicatorAuditRepository(),
  ) {}

  getByOrderId(orderId: string) {
    return this.commissionRepository.getByOrderId(orderId);
  }

  ensureForPaidOrder(order: WabaBillingOrder) {
    if (order.product !== "waba-disparos" || order.status !== "paid") return null;
    if (order.grantSource === "admin-bonus-envios") return null;
    const indicatorUserId = String(order.indicatorUserId ?? "").trim();
    const spreadAmountCents = toNonNegativeCents(order.spreadAmountCents);
    const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    const total = Math.max(0, Math.round(Number(order.shipmentCount ?? 0)));
    const quantity = Math.max(
      0,
      Math.round(
        Number(
          order.purchasedShipmentCount ??
            (bonus > 0 && total > bonus ? total - bonus : total),
        ),
      ),
    );
    if (!indicatorUserId || spreadAmountCents <= 0 || quantity <= 0) return null;

    const subscriber =
      this.subscriberRepository.getByEmail(String(order.ownerEmail ?? "").trim().toLowerCase()) ||
      this.subscriberRepository.list().find((item) => item.indicatorUserId === indicatorUserId) ||
      null;

    const now = new Date().toISOString();
    const { commission, created } = this.commissionRepository.createIfAbsent({
      id: randomUUID(),
      indicatorUserId,
      subscriberId: subscriber?.id ?? "",
      subscriberEmail: String(order.ownerEmail ?? "").trim().toLowerCase(),
      orderId: order.id,
      asaasPaymentId: String(order.asaasPaymentId ?? "").trim(),
      campaignId: "",
      quantity,
      baseUnitPriceCents: toNonNegativeCents(order.baseUnitPriceCents),
      spreadUnitPriceCents: toNonNegativeCents(order.spreadUnitPriceCents),
      customerUnitPriceCents: toNonNegativeCents(order.customerUnitPriceCents),
      baseAmountCents: toNonNegativeCents(order.baseAmountCents),
      commissionAmountCents: spreadAmountCents,
      totalAmountCents: toNonNegativeCents(order.listValueCents ?? order.valueCents),
      status: "pending",
      payoutExternalReference: buildSplitLineAsaasExternalReference({
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

  syncFromPayout(input: {
    orderId: string;
    status: "pending" | "processing" | "paid" | "failed" | "skipped";
    asaasTransferId?: string;
    transactionReceiptUrl?: string;
    failureReason?: string;
    paidAt?: string;
  }) {
    const current = this.commissionRepository.getByOrderId(input.orderId);
    if (!current || current.status === "canceled") return current;
    if (input.status === "skipped") return current;
    const mapped =
      input.status === "paid"
        ? "paid"
        : input.status === "failed"
          ? "failed"
          : input.status === "processing"
            ? "processing"
            : "pending";
    if (current.status === "paid" && mapped !== "paid") return current;
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

  cancelForReversedPayment(orderId: string, reason: string) {
    const current = this.commissionRepository.getByOrderId(orderId);
    if (!current || current.status === "canceled") return current;
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
