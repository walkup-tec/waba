import { WabaMasterDisparosPolicyService } from "../users/waba-master-disparos-policy.service";
import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import {
  resolveIntakeApiKindFromIntake,
  resolveOrderApiKind,
  resolveSubscriberDispatchesApiKindFromOrders,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import {
  emptyDisparosApiCreditsBucket,
  emptyDisparosCreditsByApi,
  type DisparosApiCreditsBucket,
  type DisparosCreditsByApi,
} from "./waba-disparos-api-credits";
import { WabaDisparosBonusSettlementService } from "./waba-disparos-bonus-settlement.service";
import { WabaDisparosBonusService } from "./waba-disparos-bonus.service";
import {
  WabaCleisonOficialBalanceRepair,
  applyCleisonOficialCreditsOverride,
  applyCleisonOficialSummaryOverride,
} from "./waba-cleison-oficial-balance-repair";
import { WabaDisparosCreditUsageRepository } from "./waba-disparos-credit-usage.repository";
import {
  resolveActiveOrderShipmentCount,
} from "./waba-disparos-order-shipments";
import { shouldCountCampaignIntakeCredits, resolveCampaignRealizedShipments } from "../disparos/waba-campaign-intake-status";
import {
  listRealPaidPurchases,
  sumPurchasedShipments,
  resolveRealPurchasedShipmentCount,
  isOperationalBalanceRepairOrder,
} from "./waba-disparos-real-purchases";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const UNLIMITED_CREDITS_REMAINING = 9_999_999;

export type DisparosCreditsSummary = {
  hasCredits: boolean;
  unlimitedCredits: boolean;
  email: string;
  activeApiKind: WabaDispatchesApiKind;
  byApi: DisparosCreditsByApi;
  contractedShipments: number;
  consumedShipments: number;
  remainingShipments: number;
  contractedValueCents: number;
  paidOrderCount: number;
  lastPaidAt: string;
  pendingBonusShipments: number;
};

export class WabaDisparosCreditsService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly usageRepository = new WabaDisparosCreditUsageRepository(),
    private readonly bonusService = new WabaDisparosBonusService(),
    private readonly bonusSettlementService = new WabaDisparosBonusSettlementService(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
    private readonly masterPolicyService = new WabaMasterDisparosPolicyService(),
    private readonly cleisonBalanceRepair = new WabaCleisonOficialBalanceRepair(),
  ) {}

  private listPaidOrdersForEmail(email: string): WabaBillingOrder[] {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];

    return this.orderRepository
      .list()
      .filter(
        (order) =>
          order.product === "waba-disparos" &&
          order.status === "paid" &&
          normalizeEmail(order.ownerEmail) === normalized &&
          String(order.paidAt ?? "").trim().length > 0,
      )
      .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
  }

  private prepareCreditsLedger(email: string): string {
    const normalized = normalizeEmail(email);
    if (!normalized) return "";
    this.ensureUsageMigrated(normalized);
    this.cleisonBalanceRepair.applyIfNeeded(normalized);
    this.bonusSettlementService.settleAllUnsettledPaidOrdersForEmail(normalized);
    return normalized;
  }

  private listRealPurchasesForEmail(email: string): WabaBillingOrder[] {
    return listRealPaidPurchases(this.orderRepository.list(), email);
  }

  private sumRealizedFromCampaigns(email: string, apiKind: WabaDispatchesApiKind): number {
    let total = 0;
    for (const intake of this.intakeRepository.listByEmail(email)) {
      if (resolveIntakeApiKindFromIntake(intake) !== apiKind) continue;
      total += resolveCampaignRealizedShipments(intake);
    }
    return total;
  }

  private rebuildConsumedByApiFromIntakes(email: string): void {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const consumedByApi: Record<WabaDispatchesApiKind, number> = {
      oficial: 0,
      alternativa: 0,
    };

    for (const intake of this.intakeRepository.listByEmail(normalized)) {
      if (!shouldCountCampaignIntakeCredits(intake.status)) continue;
      const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
      if (planned <= 0) continue;
      const apiKind = resolveIntakeApiKindFromIntake(intake);
      consumedByApi[apiKind] += planned;
    }

    this.usageRepository.setConsumedByApi(normalized, consumedByApi);
  }

  private sumConsumedFromIntakes(email: string): Record<WabaDispatchesApiKind, number> {
    const totals: Record<WabaDispatchesApiKind, number> = { oficial: 0, alternativa: 0 };
    for (const intake of this.intakeRepository.listByEmail(email)) {
      if (!shouldCountCampaignIntakeCredits(intake.status)) continue;
      const planned = Math.max(0, Math.round(Number(intake.plannedSendCount ?? 0)));
      if (planned <= 0) continue;
      totals[resolveIntakeApiKindFromIntake(intake)] += planned;
    }
    return totals;
  }

  private ensureUsageMigrated(email: string): void {
    const normalized = normalizeEmail(email);
    const fromIntakes = this.sumConsumedFromIntakes(normalized);
    const intakeTotal = fromIntakes.oficial + fromIntakes.alternativa;
    if (intakeTotal <= 0) return;

    const repoOficial = this.usageRepository.getConsumedShipments(normalized, "oficial");
    const repoAlternativa = this.usageRepository.getConsumedShipments(normalized, "alternativa");
    const repoTotal = repoOficial + repoAlternativa;

    if (
      repoTotal !== intakeTotal ||
      (fromIntakes.alternativa > 0 && repoAlternativa === 0)
    ) {
      this.rebuildConsumedByApiFromIntakes(normalized);
    }
  }

  private buildApiBucket(
    email: string,
    apiKind: WabaDispatchesApiKind,
    paidOrders: WabaBillingOrder[],
    realPurchases: WabaBillingOrder[],
  ): DisparosApiCreditsBucket {
    const purchasesForApi = realPurchases.filter((order) => resolveOrderApiKind(order) === apiKind);
    const contractedShipments = sumPurchasedShipments(purchasesForApi);
    const consumedShipments = this.sumRealizedFromCampaigns(email, apiKind);
    const bonusContracted = paidOrders
      .filter(
        (order) =>
          resolveOrderApiKind(order) === apiKind &&
          order.grantSource === "admin-bonus-envios" &&
          !isOperationalBalanceRepairOrder(order),
      )
      .reduce((sum, order) => sum + resolveActiveOrderShipmentCount(order), 0);
    const remainingShipments = Math.max(0, contractedShipments - consumedShipments) + bonusContracted;
    const pendingBonusShipments = this.bonusService.getPendingBonusShipments(email, apiKind);

    const bucket: DisparosApiCreditsBucket = {
      contractedShipments,
      consumedShipments,
      remainingShipments,
      pendingBonusShipments,
    };
    applyCleisonOficialCreditsOverride(email, apiKind, bucket);
    return bucket;
  }

  private getPaidRemainingForApi(email: string, apiKind: WabaDispatchesApiKind): number {
    const purchases = this.listRealPurchasesForEmail(email).filter(
      (order) => resolveOrderApiKind(order) === apiKind,
    );
    const contracted = sumPurchasedShipments(purchases);
    const consumed = this.sumRealizedFromCampaigns(email, apiKind);
    const bonusContracted = this.listPaidOrdersForEmail(email)
      .filter(
        (order) =>
          resolveOrderApiKind(order) === apiKind &&
          order.grantSource === "admin-bonus-envios" &&
          !isOperationalBalanceRepairOrder(order),
      )
      .reduce((sum, order) => sum + resolveActiveOrderShipmentCount(order), 0);
    return Math.max(0, contracted - consumed) + bonusContracted;
  }

  getRemainingShipmentsForApi(email: string, apiKind: WabaDispatchesApiKind): number {
    return this.getCreditsSummary(email).byApi[apiKind].remainingShipments;
  }

  getCreditsSummary(email: string): DisparosCreditsSummary {
    const normalized = this.prepareCreditsLedger(email);
    const unlimitedCredits = this.masterPolicyService.hasUnlimitedCredits(normalized);
    const paidOrders = this.listPaidOrdersForEmail(normalized);
    const realPurchases = this.listRealPurchasesForEmail(normalized);

    const byApi: DisparosCreditsByApi = {
      oficial: this.buildApiBucket(normalized, "oficial", paidOrders, realPurchases),
      alternativa: this.buildApiBucket(normalized, "alternativa", paidOrders, realPurchases),
    };

    if (unlimitedCredits) {
      for (const kind of ["oficial", "alternativa"] as const) {
        byApi[kind] = {
          ...byApi[kind],
          remainingShipments: UNLIMITED_CREDITS_REMAINING,
        };
      }
    }

    const contractedShipments =
      byApi.oficial.contractedShipments + byApi.alternativa.contractedShipments;
    const consumedShipments = byApi.oficial.consumedShipments + byApi.alternativa.consumedShipments;
    const remainingShipments = unlimitedCredits
      ? UNLIMITED_CREDITS_REMAINING
      : byApi.oficial.remainingShipments + byApi.alternativa.remainingShipments;
    const pendingBonusShipments =
      byApi.oficial.pendingBonusShipments + byApi.alternativa.pendingBonusShipments;

    const contractedValueCents = realPurchases.reduce(
      (sum, order) => sum + Math.round(Number(order.valueCents ?? 0)),
      0,
    );

    const summary = {
      hasCredits: unlimitedCredits || contractedShipments > 0,
      unlimitedCredits,
      email: normalized,
      activeApiKind: resolveSubscriberDispatchesApiKindFromOrders(normalized, this.orderRepository),
      byApi,
      contractedShipments,
      consumedShipments,
      remainingShipments,
      contractedValueCents,
      paidOrderCount: realPurchases.length,
      lastPaidAt: realPurchases[0]?.paidAt ?? "",
      pendingBonusShipments,
    };
    applyCleisonOficialSummaryOverride(normalized, summary);
    return summary;
  }

  /**
   * Consome créditos (pago primeiro, depois bônus) e devolve o breakdown.
   * Usado na geração de campanha para gravar `creditFunding` e excluir bônus do split.
   */
  consumeShipments(
    email: string,
    delta = 1,
    apiKind: WabaDispatchesApiKind = "oficial",
  ): { fromPaid: number; fromBonus: number } {
    const normalized = normalizeEmail(email);
    const amount = Math.max(0, Math.round(Number(delta)));
    if (!normalized || amount <= 0) return { fromPaid: 0, fromBonus: 0 };

    const paidRemaining = this.getPaidRemainingForApi(normalized, apiKind);
    const fromPaid = Math.min(amount, paidRemaining);
    const fromBonus = amount - fromPaid;

    if (fromPaid > 0) {
      this.usageRepository.incrementConsumedShipments(normalized, fromPaid, apiKind);
    }
    if (fromBonus > 0) {
      this.usageRepository.incrementConsumedShipments(normalized, fromBonus, apiKind);
      this.usageRepository.incrementBonusConsumedShipments(normalized, fromBonus, apiKind);
    }
    return { fromPaid, fromBonus };
  }

  recordShipmentConsumed(
    email: string,
    delta = 1,
    apiKind: WabaDispatchesApiKind = "oficial",
  ): DisparosCreditsSummary {
    const normalized = normalizeEmail(email);
    if (!normalized) return this.getCreditsSummary("");
    this.consumeShipments(normalized, delta, apiKind);
    return this.getCreditsSummary(normalized);
  }

  refreshConsumedFromIntakes(email: string): DisparosCreditsSummary {
    const normalized = normalizeEmail(email);
    if (!normalized) return this.getCreditsSummary("");
    this.rebuildConsumedByApiFromIntakes(normalized);
    return this.getCreditsSummary(normalized);
  }

  isMasterUnlimited(email: string): boolean {
    return this.masterPolicyService.hasUnlimitedCredits(normalizeEmail(email));
  }

  listPurchaseHistory(email: string, limit = 20) {
    const normalized = this.prepareCreditsLedger(email);
    const cap = Math.max(1, Math.min(50, Math.floor(limit)));
    return this.listRealPurchasesForEmail(normalized)
      .slice(0, cap)
      .map((order) => {
        const purchasedShipments = resolveRealPurchasedShipmentCount(order);
        return {
          id: order.id,
          apiKind: resolveOrderApiKind(order),
          valueCents: Math.max(0, Math.round(Number(order.valueCents ?? 0))),
          purchasedShipmentCount: purchasedShipments,
          shipmentCount: purchasedShipments,
          bonusShipmentsApplied: 0,
          paidAt: String(order.paidAt ?? ""),
        };
      });
  }

  listBonusHistory(email: string, limit = 20) {
    const normalized = this.prepareCreditsLedger(email);
    const cap = Math.max(1, Math.min(50, Math.floor(limit)));
    return this.bonusService.listBonusGrantHistory(normalized, cap);
  }
}

export { emptyDisparosApiCreditsBucket, emptyDisparosCreditsByApi };
