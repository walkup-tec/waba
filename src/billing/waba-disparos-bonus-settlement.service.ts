import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { WabaDisparosBonusService } from "./waba-disparos-bonus.service";
import { resolveOrderShipmentCount } from "./waba-disparos-order-shipments";
import { resolveOrderApiKind } from "../disparos/waba-dispatches-api-kind";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/**
 * Na próxima compra paga de um plano, soma os créditos bonificados daquele plano
 * ao pedido e zera o saldo bonificado correspondente.
 */
export class WabaDisparosBonusSettlementService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly bonusService = new WabaDisparosBonusService(),
  ) {}

  private listPaidDisparosOrdersForEmail(email: string): WabaBillingOrder[] {
    const normalized = normalizeEmail(email);
    return this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-disparos" &&
          order.status === "paid" &&
          normalizeEmail(order.ownerEmail) === normalized &&
          String(order.paidAt ?? "").trim().length > 0,
      )
      .sort(
        (a, b) =>
          new Date(a.paidAt || a.updatedAt).getTime() -
          new Date(b.paidAt || b.updatedAt).getTime(),
      );
  }

  private findBonusSettlementOrder(
    email: string,
    apiKind: ReturnType<typeof resolveOrderApiKind>,
  ): WabaBillingOrder | null {
    const pending = this.bonusService.getPendingBonusShipments(email, apiKind);
    if (pending <= 0) return null;

    const earliestGrantAt = this.bonusService.getEarliestGrantAt(email, apiKind);
    if (!earliestGrantAt) return null;

    const grantTime = new Date(earliestGrantAt).getTime();
    const eligible = this.listPaidDisparosOrdersForEmail(email).filter((order) => {
      if (resolveOrderApiKind(order) !== apiKind) return false;
      const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
      if (applied > 0) return false;
      const paidAt = String(order.paidAt ?? "").trim();
      if (!paidAt) return false;
      return new Date(paidAt).getTime() >= grantTime;
    });

    return eligible[0] ?? null;
  }

  private canApplyPendingBonusToOrder(order: WabaBillingOrder): boolean {
    const apiKind = resolveOrderApiKind(order);
    const target = this.findBonusSettlementOrder(order.ownerEmail, apiKind);
    return target?.id === order.id;
  }

  settlePaidOrder(order: WabaBillingOrder): WabaBillingOrder {
    if (order.product !== "waba-disparos" || order.status !== "paid") return order;

    const alreadyApplied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    if (alreadyApplied > 0) return order;

    const apiKind = resolveOrderApiKind(order);
    const totalShipments = resolveOrderShipmentCount(order);
    const purchasedShipments = totalShipments - alreadyApplied;
    const now = new Date().toISOString();

    let bonusToApply = 0;
    if (this.canApplyPendingBonusToOrder(order)) {
      bonusToApply = this.bonusService.getPendingBonusShipments(order.ownerEmail, apiKind);
    }

    const hasSettlementMark = String(order.bonusSettlementAt ?? "").trim().length > 0;
    if (hasSettlementMark && bonusToApply <= 0) return order;

    return (
      this.orderRepository.update(order.id, {
        shipmentCount: purchasedShipments + bonusToApply,
        bonusShipmentsApplied: bonusToApply,
        bonusSettlementAt: now,
      }) ?? order
    );
  }

  settleAllUnsettledPaidOrdersForEmail(email: string): void {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    for (const order of this.listPaidDisparosOrdersForEmail(normalized)) {
      const fresh = this.orderRepository.getById(order.id);
      if (fresh) this.settlePaidOrder(fresh);
    }
  }
}
