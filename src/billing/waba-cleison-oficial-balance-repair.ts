import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import type { DisparosApiCreditsBucket } from "./waba-disparos-api-credits";
import { resolveOrderApiKind } from "../disparos/waba-dispatches-api-kind";
import { resolveDataFile } from "../data-path";
import {
  isOrderCreditsActive,
  resolvePurchasedShipmentCount,
} from "./waba-disparos-order-shipments";

export const CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
export const CLEISON_OFICIAL_FORCED_REMAINING = 5829;
export const CLEISON_OFICIAL_PACK_SIZE = 5000;
export const CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";
export const CLEISON_VOID_1016_ADMIN_GRANTS_MARKER = "waba-cleison-void-1016-admin-grants.json";
const DUPLICATE_1016_ADMIN_GRANT = 1016;

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
    this.voidDuplicate1016AdminGrantsOnce();
  }

  /**
   * Uma vez: desativa os bônus master 1016 vitalícios duplicados do Cleison.
   * Não mexe na compra Asaas nem no bônus de campanha liquidado nela.
   */
  voidDuplicate1016AdminGrantsOnce(): void {
    const markerPath = resolveDataFile(CLEISON_VOID_1016_ADMIN_GRANTS_MARKER);
    if (existsSync(markerPath)) return;

    const now = new Date().toISOString();
    const orders = this.orderRepository.list();
    const voidedIds: string[] = [];

    for (const order of orders) {
      if (order.product !== "waba-disparos") continue;
      if (resolveOrderApiKind(order) !== "oficial") continue;
      if (normalizeEmail(order.ownerEmail) !== CLEISON_OFICIAL_TARGET_EMAIL) continue;
      if (order.grantSource !== "admin-bonus-envios") continue;
      if (isForceBalanceOrder(order) || order.grantCreatedByEmail === "system-balance-repair") continue;
      if (order.grantActive === false) continue;
      if (Math.max(0, Math.round(Number(order.shipmentCount ?? 0))) !== DUPLICATE_1016_ADMIN_GRANT) {
        continue;
      }
      const lifetime =
        order.validityMode === "lifetime" || !String(order.creditsValidUntil ?? "").trim();
      if (!lifetime) continue;
      const createdMs = Date.parse(String(order.createdAt ?? ""));
      if (!Number.isFinite(createdMs) || createdMs >= Date.parse("2026-09-09T15:00:00.000Z")) {
        continue;
      }

      order.grantActive = false;
      order.updatedAt = now;
      voidedIds.push(order.id);
    }

    if (!voidedIds.length) return;
    this.orderRepository.replaceAll(orders);
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(
      markerPath,
      JSON.stringify({ voidedAt: now, orderIds: voidedIds }, null, 2),
      "utf-8",
    );
  }

  restoreOrdersDamagedByForceBalance(): void {
    const now = new Date().toISOString();
    const expiredUntil = new Date(Date.now() - 60_000).toISOString();
    const orders = this.orderRepository.list();
    const supersededIds = this.collectSupersededOriginalPackIds(orders);
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

      if (supersededIds.has(order.id)) {
        if (this.expireSupersededPack(order, now, expiredUntil)) changed = true;
        continue;
      }

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

  /**
   * Pacote original (5.000) já representado pelo restante (1.849): não reativa.
   * Mantém só o PIX mais recente quando ele é posterior ao restante.
   */
  private collectSupersededOriginalPackIds(orders: WabaBillingOrder[]): Set<string> {
    const purchases = orders.filter((order) => {
      if (order.product !== "waba-disparos") return false;
      if (resolveOrderApiKind(order) !== "oficial") return false;
      if (normalizeEmail(order.ownerEmail) !== CLEISON_OFICIAL_TARGET_EMAIL) return false;
      if (order.status !== "paid") return false;
      if (order.grantSource === "admin-bonus-envios") return false;
      if (isForceBalanceOrder(order) || order.grantCreatedByEmail === "system-balance-repair") {
        return false;
      }
      return String(order.paidAt ?? "").trim().length > 0;
    });

    const remainders = purchases.filter((order) => {
      const purchased = resolvePurchasedShipmentCount(order);
      return purchased > 0 && purchased < CLEISON_OFICIAL_PACK_SIZE;
    });
    if (!remainders.length) return new Set();

    const paidMs = (order: WabaBillingOrder): number => {
      const ms = Date.parse(String(order.paidAt ?? order.createdAt ?? ""));
      return Number.isFinite(ms) ? ms : 0;
    };

    const packs = purchases
      .filter((order) => resolvePurchasedShipmentCount(order) >= CLEISON_OFICIAL_PACK_SIZE)
      .sort((a, b) => paidMs(b) - paidMs(a));
    const latestPack = packs[0];
    const latestIsNewPurchase = Boolean(
      latestPack && remainders.every((remainder) => paidMs(remainder) < paidMs(latestPack)),
    );
    const keepId = latestIsNewPurchase && latestPack ? latestPack.id : "";

    return new Set(packs.filter((order) => order.id !== keepId).map((order) => order.id));
  }

  private expireSupersededPack(
    order: WabaBillingOrder,
    now: string,
    expiredUntil: string,
  ): boolean {
    if (!isOrderCreditsActive(order) && order.grantActive === false && creditsUntilIsPast(order)) {
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
