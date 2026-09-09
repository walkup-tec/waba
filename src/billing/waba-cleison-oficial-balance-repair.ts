import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import type { DisparosApiCreditsBucket } from "./waba-disparos-api-credits";
import { resolveOrderApiKind } from "../disparos/waba-dispatches-api-kind";

export const CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
export const CLEISON_OFICIAL_FORCED_REMAINING = 5829;
export const CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isForceBalanceOrder = (order: { asaasExternalReference?: string | null }): boolean =>
  String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF;

const creditsUntilIsPast = (order: { creditsValidUntil?: string | null }, nowMs = Date.now()): boolean => {
  const until = String(order.creditsValidUntil ?? "").trim();
  if (!until) return false;
  const untilMs = Date.parse(until);
  return Number.isFinite(untilMs) && untilMs < nowMs;
};

const asaasPaymentLooksPending = (order: WabaBillingOrder): boolean => {
  const status = String(order.asaasPaymentStatus ?? "").trim().toUpperCase();
  return (
    status === "PENDING" ||
    status === "AWAITING" ||
    status === "AWAITING_PAYMENT" ||
    status === "OVERDUE" ||
    status === "PAYMENT_OVERDUE"
  );
};

export function isCleisonOficialBalanceTarget(email: string): boolean {
  return normalizeEmail(email) === CLEISON_OFICIAL_TARGET_EMAIL;
}

export type CleisonCreditsSummarySlice = {
  email?: string;
  byApi: {
    oficial?: DisparosApiCreditsBucket;
    alternativa?: DisparosApiCreditsBucket;
  };
  remainingShipments: number;
  pendingBonusShipments: number;
};

/** Overlay 5829/0 removido: compras Asaas e grant master precisam contar de verdade. */
export function applyCleisonOficialCreditsOverride(
  _email: string,
  _apiKind: "oficial" | "alternativa",
  _bucket: DisparosApiCreditsBucket,
): void {}

export function applyCleisonOficialSummaryOverride(
  _email: string,
  _summary: CleisonCreditsSummarySlice,
): void {}

/**
 * Desfaz o congelamento operacional 5829/0 que expirava compras pagas e grants master.
 */
export class WabaCleisonOficialBalanceRepair {
  constructor(private readonly orderRepository = new WabaBillingOrderRepository()) {}

  applyIfNeeded(email: string): void {
    if (!isCleisonOficialBalanceTarget(email)) return;
    this.restoreOrdersDamagedByForceBalance();
  }

  restoreOrdersDamagedByForceBalance(): void {
    const now = new Date().toISOString();
    const expiredUntil = new Date(Date.now() - 60_000).toISOString();
    const orders = this.orderRepository.list();
    let changed = false;

    for (const order of orders) {
      if (order.product !== "waba-disparos") continue;
      if (resolveOrderApiKind(order) !== "oficial") continue;
      if (normalizeEmail(order.ownerEmail) !== CLEISON_OFICIAL_TARGET_EMAIL) continue;

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

      if (order.status !== "paid") continue;

      const untilPast = creditsUntilIsPast(order);
      const grantKilled =
        order.grantSource === "admin-bonus-envios" && order.grantActive === false && untilPast;
      const purchaseKilled =
        order.grantSource !== "admin-bonus-envios" && untilPast && !asaasPaymentLooksPending(order);
      if (!grantKilled && !purchaseKilled) continue;

      order.grantActive = true;
      order.creditsValidUntil = null;
      order.validityMode = "lifetime";
      order.updatedAt = now;
      changed = true;
    }

    if (changed) this.orderRepository.replaceAll(orders);
  }
}
