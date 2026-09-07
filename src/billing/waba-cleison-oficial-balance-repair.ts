import { randomUUID } from "node:crypto";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { WabaDisparosBonusRepository } from "./waba-disparos-bonus.repository";
import { WabaDisparosBonusService } from "./waba-disparos-bonus.service";
import type { DisparosApiCreditsBucket } from "./waba-disparos-api-credits";
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

/** A tela Saldos lê este bucket. Trava Disponível=5829 e Bonificados=0 para o Cleison. */
export function applyCleisonOficialCreditsOverride(
  email: string,
  apiKind: "oficial" | "alternativa",
  bucket: DisparosApiCreditsBucket,
  bonusConsumedShipments = 0,
): void {
  if (isRepairSkipped()) return;
  if (apiKind !== "oficial") return;
  if (!isCleisonOficialBalanceTarget(email)) return;
  const consumed = Math.max(0, Math.round(Number(bonusConsumedShipments ?? 0)));
  bucket.remainingShipments = Math.max(0, CLEISON_OFICIAL_FORCED_REMAINING - consumed);
  bucket.pendingBonusShipments = 0;
}

/**
 * Ajuste operacional: Disponível Oficial = 5.829 e Bonificados = 0.
 * Cura o grant forçado a cada GET (o ajuste anterior parava se o pedido já existisse).
 * Absorve Jandira + Jandira 2 para o pending não voltar no sync de campanha.
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
    const forceOrder = this.ensureForceOrder();
    this.expireOtherOfficialOrders(forceOrder.id);
    this.neutralizePendingOfficialCheckouts(forceOrder.id);
    this.healForceOrder(forceOrder.id);
  }

  private listOfficialOrders(): WabaBillingOrder[] {
    return this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-disparos" &&
          resolveOrderApiKind(order) === "oficial" &&
          normalizeEmail(order.ownerEmail) === CLEISON_OFICIAL_TARGET_EMAIL,
      );
  }

  private findForceOrder(): WabaBillingOrder | null {
    return (
      this.listOfficialOrders().find(
        (order) => String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF,
      ) ?? null
    );
  }

  private expireAt(): string {
    return new Date(Date.now() - 60_000).toISOString();
  }

  private grantedOfficialBonus(): number {
    return this.bonusRepository.getGrantedShipments(CLEISON_OFICIAL_TARGET_EMAIL, "oficial");
  }

  private ensureForceOrder(): WabaBillingOrder {
    const existing = this.findForceOrder();
    if (existing) return existing;
    return this.createForceOrder();
  }

  private expireOtherOfficialOrders(keepId: string): void {
    const until = this.expireAt();
    for (const order of this.listOfficialOrders()) {
      if (order.id === keepId) continue;
      if (String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF) continue;
      if (order.status !== "paid") continue;
      this.orderRepository.update(order.id, {
        creditsValidUntil: until,
        validityMode: "custom",
        grantActive: false,
      });
    }
  }

  private neutralizePendingOfficialCheckouts(keepId: string): void {
    const until = this.expireAt();
    const now = new Date().toISOString();
    for (const order of this.listOfficialOrders()) {
      if (order.id === keepId) continue;
      if (order.status !== "pending_payment") continue;
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

  private healForceOrder(forceId: string): void {
    const now = new Date().toISOString();
    const current = this.orderRepository.getById(forceId);
    if (!current) return;
    const granted = this.grantedOfficialBonus();
    const alreadyApplied = Math.max(0, Math.round(Number(current.bonusShipmentsApplied ?? 0)));
    this.orderRepository.update(forceId, {
      status: "paid",
      paidAt: String(current.paidAt ?? now),
      shipmentCount: CLEISON_OFICIAL_FORCED_REMAINING,
      grantSource: "admin-bonus-envios",
      grantCreatedByEmail: "system-balance-repair",
      grantActive: true,
      creditsValidUntil: null,
      validityMode: "lifetime",
      bonusSettlementAt: now,
      bonusShipmentsApplied: Math.max(granted, alreadyApplied),
      asaasExternalReference: CLEISON_OFICIAL_FORCE_REF,
    });
  }

  private createForceOrder(): WabaBillingOrder {
    const now = new Date().toISOString();
    const existing = this.listOfficialOrders()[0];
    const order: WabaBillingOrder = {
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
