import { randomUUID } from "node:crypto";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { isOrderCreditsActive } from "./waba-disparos-order-shipments";
import { resolveOrderApiKind } from "../disparos/waba-dispatches-api-kind";

const TARGET_EMAIL = "cleison.fel@gmail.com";
const TARGET_REMAINING = 5829;
const FORCE_REF = "waba:force-balance:cleison-oficial-5829";
const BONUS_TO_APPLY = 829;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isRepairSkipped = (): boolean =>
  String(process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR ?? "").trim() === "1";

/**
 * Ajuste operacional único: disponível Oficial = 5.829 e Bonificados = 0.
 * O PIX antigo não deve somar de novo depois (outros pedidos Oficiais ativos expiram).
 */
export class WabaCleisonOficialBalanceRepair {
  constructor(private readonly orderRepository = new WabaBillingOrderRepository()) {}

  applyIfNeeded(email: string): void {
    if (isRepairSkipped()) return;
    if (normalizeEmail(email) !== TARGET_EMAIL) return;

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

  private listOfficialOrders(): WabaBillingOrder[] {
    return this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-disparos" &&
          resolveOrderApiKind(order) === "oficial" &&
          normalizeEmail(order.ownerEmail) === TARGET_EMAIL,
      );
  }

  private findForceOrder(): WabaBillingOrder | null {
    return (
      this.listOfficialOrders().find(
        (order) => String(order.asaasExternalReference ?? "").trim() === FORCE_REF,
      ) ?? null
    );
  }

  private expireAt(): string {
    return new Date(Date.now() - 60_000).toISOString();
  }

  private expireOtherOfficialOrders(keepId: string): void {
    const until = this.expireAt();
    for (const order of this.listOfficialOrders()) {
      if (keepId && order.id === keepId) continue;
      if (order.status !== "paid") continue;
      if (!isOrderCreditsActive(order)) continue;
      this.orderRepository.update(order.id, {
        creditsValidUntil: until,
        validityMode: "custom",
      });
    }
  }

  private neutralizePendingOfficialCheckouts(keepId: string): void {
    const until = this.expireAt();
    const now = new Date().toISOString();
    for (const order of this.listOfficialOrders()) {
      if (keepId && order.id === keepId) continue;
      if (order.status !== "pending_payment") continue;
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

  private createForceOrder(): WabaBillingOrder {
    const now = new Date().toISOString();
    const existing = this.listOfficialOrders()[0];
    const order: WabaBillingOrder = {
      id: randomUUID(),
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
