import { randomUUID } from "node:crypto";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { WabaDisparosBonusRepository } from "./waba-disparos-bonus.repository";
import { WabaDisparosBonusService } from "./waba-disparos-bonus.service";
import type { DisparosApiCreditsBucket, DisparosCreditsByApi } from "./waba-disparos-api-credits";
import { resolveOrderApiKind } from "../disparos/waba-dispatches-api-kind";

export const CLEISON_OFICIAL_TARGET_EMAIL = "cleison.fel@gmail.com";
export const CLEISON_OFICIAL_FORCED_REMAINING = 5829;
export const CLEISON_OFICIAL_FORCE_REF = "waba:force-balance:cleison-oficial-5829";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isRepairSkipped = (): boolean =>
  String(process.env.WABA_SKIP_CLEISON_BALANCE_REPAIR ?? "").trim() === "1";

export function isCleisonOficialBalanceTarget(email: string): boolean {
  return normalizeEmail(email) === CLEISON_OFICIAL_TARGET_EMAIL;
}

export type CleisonCreditsSummarySlice = {
  email?: string;
  byApi: DisparosCreditsByApi;
  remainingShipments: number;
  pendingBonusShipments: number;
};

/** Tela Saldos: Disponíveis=5829 e Bonificados=0. Sem descontar consumo antigo. */
export function applyCleisonOficialCreditsOverride(
  email: string,
  apiKind: "oficial" | "alternativa",
  bucket: DisparosApiCreditsBucket,
): void {
  if (isRepairSkipped()) return;
  if (apiKind !== "oficial") return;
  if (!isCleisonOficialBalanceTarget(email)) return;
  bucket.remainingShipments = CLEISON_OFICIAL_FORCED_REMAINING;
  bucket.pendingBonusShipments = 0;
}

export function applyCleisonOficialSummaryOverride(
  email: string,
  summary: CleisonCreditsSummarySlice,
): void {
  if (isRepairSkipped()) return;
  const target =
    isCleisonOficialBalanceTarget(email) || isCleisonOficialBalanceTarget(summary.email ?? "");
  if (!target) return;
  if (!summary.byApi?.oficial) return;
  summary.byApi.oficial.remainingShipments = CLEISON_OFICIAL_FORCED_REMAINING;
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
export class WabaCleisonOficialBalanceRepair {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly bonusRepository = new WabaDisparosBonusRepository(),
    private readonly bonusService = new WabaDisparosBonusService(),
  ) {}

  applyIfNeeded(email: string): void {
    if (isRepairSkipped()) return;
    if (!isCleisonOficialBalanceTarget(email)) return;

    this.bonusService.syncPendingBonusFromCompletedCampaigns(CLEISON_OFICIAL_TARGET_EMAIL);
    const now = new Date().toISOString();
    const until = new Date(Date.now() - 60_000).toISOString();
    const granted = this.bonusRepository.getGrantedShipments(
      CLEISON_OFICIAL_TARGET_EMAIL,
      "oficial",
    );
    const orders = this.orderRepository.list();
    const official = orders.filter(
      (order) =>
        order.product === "waba-disparos" &&
        resolveOrderApiKind(order) === "oficial" &&
        normalizeEmail(order.ownerEmail) === CLEISON_OFICIAL_TARGET_EMAIL,
    );

    let force =
      official.find(
        (order) => String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF,
      ) ?? null;

    if (!force) {
      const existing = official[0];
      force = {
        id: randomUUID(),
        product: "waba-disparos",
        apiKind: "oficial",
        customerName: String(existing?.customerName || "Cleison").trim() || "Cleison",
        ownerEmail: CLEISON_OFICIAL_TARGET_EMAIL,
        whatsapp: String(existing?.whatsapp || "").trim(),
        cpfCnpj: String(existing?.cpfCnpj || "").trim(),
        billingType: "PIX",
        valueCents: 0,
        shipmentCount: CLEISON_OFICIAL_FORCED_REMAINING,
        status: "paid",
        asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
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
        order.shipmentCount = CLEISON_OFICIAL_FORCED_REMAINING;
        order.grantSource = "admin-bonus-envios";
        order.grantCreatedByEmail = "system-balance-repair";
        order.grantActive = true;
        order.creditsValidUntil = null;
        order.validityMode = "lifetime";
        order.bonusSettlementAt = now;
        order.bonusShipmentsApplied = Math.max(granted, alreadyApplied);
        order.asaasExternalReference = CLEISON_OFICIAL_FORCE_REF;
        order.apiKind = "oficial";
        order.ownerEmail = CLEISON_OFICIAL_TARGET_EMAIL;
        order.updatedAt = now;
        continue;
      }

      if (order.product !== "waba-disparos") continue;
      if (resolveOrderApiKind(order) !== "oficial") continue;
      if (normalizeEmail(order.ownerEmail) !== CLEISON_OFICIAL_TARGET_EMAIL) continue;
      if (String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF) continue;

      if (order.status === "pending_payment") {
        order.status = "paid";
        order.paidAt = now;
        order.creditsValidUntil = until;
        order.validityMode = "custom";
        order.grantActive = false;
        order.bonusSettlementAt = now;
        order.bonusShipmentsApplied = Math.max(
          0,
          Math.round(Number(order.bonusShipmentsApplied ?? 0)),
        );
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
