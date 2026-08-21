import { randomUUID } from "node:crypto";
import { WabaMasterDisparosPolicyService } from "../users/waba-master-disparos-policy.service";
import { resolveOrderApiKind, resolveIntakeApiKindFromIntake } from "../disparos/waba-dispatches-api-kind";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import type { WabaCampaignIntake } from "../disparos/waba-campaign-intake.repository";
import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { resolveOrderShipmentCount } from "./waba-disparos-order-shipments";
import {
  WabaFinanceiroSplitRepository,
  type FinanceiroSplitConfig,
  type SplitParticipant,
  type SplitSupplier,
} from "./waba-financeiro-split.repository";
import {
  WabaFinanceiroSplitSettlementRepository,
  deriveSettlementPayoutStatus,
} from "./waba-financeiro-split-settlement.repository";
import type {
  FinanceiroSplitSettlement,
  SplitSettlementLine,
} from "./waba-financeiro-split-settlement.repository";
import { WabaFinanceiroSplitPayoutService } from "./waba-financeiro-split-payout.service";
import {
  resolveFinanceiroCetCentsForPaidOrder,
  resolveFinanceiroCetCentsPerOperation,
} from "./waba-financeiro-cet";
import {
  filterOutMetricsExcludedOwners,
  isWabaMetricsExcludedOwnerEmail,
  WABA_METRICS_EXCLUDED_OWNER_EMAILS,
} from "./waba-metrics-excluded-owners";
import {
  isBonusOnlyCampaignFunding,
  resolveBillableSentForSupplierSplit,
} from "./waba-campaign-credit-funding";
const PERCENT_SUM_TOLERANCE = 0.01;

type SplitCostBreakdown = {
  supplierCostCents: number;
  cetCents: number;
  totalCostCents: number;
  distributableCents: number;
};

const roundPercent = (value: number): number => Math.round(value * 100) / 100;

const buildSplitCostBreakdown = (
  paidValueCents: number,
  purchasedShipmentCount: number,
  costPerShipmentCents: number,
): SplitCostBreakdown => {
  const supplierCostCents = Math.max(
    0,
    Math.round(purchasedShipmentCount * Math.max(0, costPerShipmentCents)),
  );
  const cetCents = resolveFinanceiroCetCentsForPaidOrder();
  const totalCostCents = supplierCostCents + cetCents;
  const distributableCents = Math.max(0, paidValueCents - totalCostCents);
  return { supplierCostCents, cetCents, totalCostCents, distributableCents };
};

const resolveSettlementCostBreakdown = (
  settlement: FinanceiroSplitSettlement,
): SplitCostBreakdown => {
  const cetCents =
    settlement.cetCents ??
    settlement.cofCents ??
    (settlement.lines.some((line) => line.lineKind === "cet")
      ? resolveFinanceiroCetCentsForPaidOrder()
      : 0);
  const supplierLine = settlement.lines.find((line) => line.lineKind === "supplier");
  const supplierCostCents =
    settlement.supplierCostCents ??
    supplierLine?.amountCents ??
    Math.max(0, settlement.totalCostCents - cetCents);
  const usesNewModel =
    settlement.supplierCostCents != null ||
    settlement.cetCents != null ||
    settlement.cofCents != null ||
    settlement.lines.some((line) => line.lineKind === "cet");
  const totalCostCents = usesNewModel
    ? supplierCostCents + cetCents
    : settlement.totalCostCents;
  const distributableCents = usesNewModel
    ? Math.max(0, settlement.paidValueCents - totalCostCents)
    : settlement.distributableCents;

  let compositionSupplier = Math.max(0, supplierCostCents);
  let compositionCet = Math.max(0, usesNewModel ? cetCents : 0);
  if (!usesNewModel && totalCostCents > 0) {
    compositionSupplier = supplierLine?.amountCents ?? totalCostCents;
    compositionCet = 0;
  }
  if (compositionSupplier + compositionCet <= 0 && totalCostCents > 0) {
    compositionSupplier = totalCostCents;
  }

  return {
    supplierCostCents: compositionSupplier,
    cetCents: compositionCet,
    totalCostCents,
    distributableCents,
  };
};

const distributeCentsByPercents = (totalCents: number, percents: number[]): number[] => {
  if (totalCents <= 0 || !percents.length) return percents.map(() => 0);
  const raw = percents.map((percent) => (totalCents * percent) / 100);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = totalCents - floors.reduce((sum, value) => sum + value, 0);
  const ranked = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i += 1) {
    floors[ranked[i % ranked.length].index] += 1;
  }
  return floors;
};

const normalizeParticipant = (input: Partial<SplitParticipant>): SplitParticipant => ({
  id: String(input.id ?? randomUUID()).trim() || randomUUID(),
  label: String(input.label ?? "").trim(),
  email: String(input.email ?? "").trim().toLowerCase(),
  pixKey: String(input.pixKey ?? "").trim(),
  sharePercent: roundPercent(Math.max(0, Math.min(100, Number(input.sharePercent ?? 0)))),
  active: input.active !== false,
});

const normalizeSupplier = (input: Partial<SplitSupplier>): SplitSupplier => {
  const apiKind: WabaDispatchesApiKind = input.apiKind === "alternativa" ? "alternativa" : "oficial";
  const segment = input.segment === "bets" ? "bets" : "outros";
  const priorityRaw = Math.round(Number(input.priority ?? 1));
  const priority = Math.max(1, Math.min(5, Number.isFinite(priorityRaw) ? priorityRaw : 1));
  return {
    id: String(input.id ?? randomUUID()).trim() || randomUUID(),
    name: String(input.name ?? "").trim(),
    apiKind,
    systemUserEmail: String(input.systemUserEmail ?? "").trim().toLowerCase(),
    segment,
    priority,
    costPerShipmentCents: Math.max(0, Math.round(Number(input.costPerShipmentCents ?? 0))),
    pixKey: String(input.pixKey ?? "").trim(),
    active: input.active !== false,
  };
};

export class WabaFinanceiroSplitService {
  constructor(
    private readonly configRepository = new WabaFinanceiroSplitRepository(),
    private readonly settlementRepository = new WabaFinanceiroSplitSettlementRepository(),
    private readonly payoutService = new WabaFinanceiroSplitPayoutService(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly masterPolicyService = new WabaMasterDisparosPolicyService(),
  ) {}

  getConfig(): FinanceiroSplitConfig {
    return this.configRepository.get();
  }

  isPayoutEnabled(): boolean {
    return this.payoutService.isPayoutEnabled();
  }

  listSettlements(limit = 100) {
    this.absorbSyntheticCampaignSupplierSettlements();
    return filterOutMetricsExcludedOwners(this.settlementRepository.list(limit));
  }

  /** Remove settlements já gravados de owners excluídos das métricas/split. */
  purgeExcludedOwnerSettlements(): { removed: number; ids: string[] } {
    return this.settlementRepository.deleteByOwnerEmails([...WABA_METRICS_EXCLUDED_OWNER_EMAILS]);
  }

  /**
   * Remove settlements de campanhas 100% bônus e de pedidos grant admin-bonus-envios.
   */
  purgeBonusOnlyCampaignSettlements(): { removed: number; ids: string[] } {
    const intakeRepository = new WabaCampaignIntakeRepository();
    const backfill = intakeRepository.backfillBonusFundingForOpenCampaigns();
    if (backfill.updated > 0) {
      console.info(
        `[FinanceiroSplit] backfill creditFunding bônus em ${backfill.updated} campanha(s) em fila`,
      );
    }

    const intakes = intakeRepository.listAll();
    const orderIds: string[] = [];
    for (const intake of intakes) {
      if (!isBonusOnlyCampaignFunding(intake.creditFunding)) continue;
      orderIds.push(this.buildCampaignSupplierOrderId(intake.id));
    }
    for (const order of this.orderRepository.list()) {
      if (order.grantSource === "admin-bonus-envios") {
        orderIds.push(order.id);
      }
    }
    return this.settlementRepository.deleteByOrderIds(orderIds);
  }

  async syncSettlementTransferStatuses(limit = 100): Promise<number> {
    return this.payoutService.syncProcessingTransfers(limit);
  }

  getSettlementByOrderId(orderId: string) {
    return this.settlementRepository.getByOrderId(orderId);
  }

  private resolveActiveSupplier(
    config: FinanceiroSplitConfig,
    apiKind: WabaDispatchesApiKind,
    segment: WabaSystemUserOperacionalSegment = "outros",
  ): SplitSupplier | null {
    return this.listActiveSuppliersForPlanSegmentFromConfig(config, apiKind, segment)[0] ?? null;
  }

  listActiveSuppliersForPlanSegment(
    apiKind: WabaDispatchesApiKind,
    segment: WabaSystemUserOperacionalSegment,
  ): SplitSupplier[] {
    const config = this.configRepository.get();
    return this.listActiveSuppliersForPlanSegmentFromConfig(config, apiKind, segment);
  }

  listActiveSuppliersForPlanSegmentFromConfig(
    config: FinanceiroSplitConfig,
    apiKind: WabaDispatchesApiKind,
    segment: WabaSystemUserOperacionalSegment,
  ): SplitSupplier[] {
    return config.suppliers
      .filter((item) => item.active && item.apiKind === apiKind && item.segment === segment)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "pt-BR"));
  }

  private shouldDeferSupplierPayout(supplier: SplitSupplier | null): boolean {
    return Boolean(supplier?.systemUserEmail);
  }

  private resolveSubscriberSegmentForEmail(email: string): WabaSystemUserOperacionalSegment {
    const subscriber = new WabaSubscriberRepository().getByEmail(email);
    return subscriber?.segment === "bets" ? "bets" : "outros";
  }

  validateConfig(input: FinanceiroSplitConfig): FinanceiroSplitConfig {
    const suppliers = (Array.isArray(input.suppliers) ? input.suppliers : []).map(normalizeSupplier);
    const participants = (Array.isArray(input.participants) ? input.participants : []).map(
      normalizeParticipant,
    );

    const activeSuppliers = suppliers.filter((item) => item.active);
    const priorityKeys = new Set<string>();
    const operacionalEmails = new Set<string>();
    for (const supplier of activeSuppliers) {
      if (!supplier.name) {
        throw new Error("Cada fornecedor ativo precisa de um nome.");
      }
      if (!supplier.systemUserEmail) {
        throw new Error(`Selecione o usuário operacional do fornecedor ${supplier.name || "sem nome"}.`);
      }
      if (!supplier.pixKey || supplier.pixKey.length < 5) {
        throw new Error(`Informe a chave PIX do fornecedor ${supplier.name || "sem nome"}.`);
      }
      const groupKey = `${supplier.apiKind}:${supplier.segment}`;
      const priorityKey = `${groupKey}:${supplier.priority}`;
      if (priorityKeys.has(priorityKey)) {
        throw new Error(
          `Já existe fornecedor ativo com prioridade ${supplier.priority} para ${supplier.apiKind === "oficial" ? "API Oficial" : "API Alternativa"} / ${supplier.segment === "bets" ? "Bets" : "Outros"}.`,
        );
      }
      priorityKeys.add(priorityKey);
      const operacionalKey = `${supplier.systemUserEmail}:${supplier.apiKind}:${supplier.segment}`;
      if (operacionalEmails.has(operacionalKey)) {
        throw new Error(
          "Cada usuário operacional só pode ser fornecedor uma vez por plano + segmento (ex.: Oficial/Bets).",
        );
      }
      operacionalEmails.add(operacionalKey);
    }

    const activeParticipants = participants.filter((item) => item.active);
    for (const participant of activeParticipants) {
      if (!participant.label) {
        throw new Error("Cada participante ativo precisa de um usuário master selecionado.");
      }
      if (!participant.email) {
        throw new Error(`Selecione o usuário master de ${participant.label || "participante"}.`);
      }
      if (!participant.pixKey || participant.pixKey.length < 5) {
        throw new Error(`Informe a chave PIX de ${participant.label || "participante"}.`);
      }
      if (participant.sharePercent <= 0) {
        throw new Error(`Percentual de ${participant.label} deve ser maior que zero.`);
      }
    }

    if (activeParticipants.length) {
      const emails = new Set<string>();
      for (const participant of activeParticipants) {
        if (emails.has(participant.email)) {
          throw new Error("Cada usuário master só pode aparecer uma vez no rateio do lucro.");
        }
        emails.add(participant.email);
      }
    }

    return {
      version: 2,
      suppliers,
      participants,
      updatedAt: new Date().toISOString(),
    };
  }

  saveConfig(input: FinanceiroSplitConfig): FinanceiroSplitConfig {
    const validated = this.validateConfig(input);
    return this.configRepository.save(validated);
  }

  private resolvePurchasedShipmentCount(order: WabaBillingOrder): number {
    const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    const total = resolveOrderShipmentCount(order);
    if (bonus > 0 && total > bonus) return total - bonus;
    return total;
  }

  resolveOrderEconomics(order: WabaBillingOrder) {
    if (order.product !== "waba-disparos" || order.status !== "paid") return null;
    if (isWabaMetricsExcludedOwnerEmail(order.ownerEmail)) return null;

    const settlement = this.settlementRepository.getByOrderId(order.id);
    if (settlement) {
      if (isWabaMetricsExcludedOwnerEmail(settlement.ownerEmail)) return null;
      const breakdown = resolveSettlementCostBreakdown(settlement);
      return {
        apiKind: settlement.apiKind,
        contractedValueCents: settlement.paidValueCents,
        supplierCostCents: breakdown.supplierCostCents,
        totalCostCents: breakdown.totalCostCents,
        grossProfitCents: breakdown.distributableCents,
        cetCents: breakdown.cetCents,
        distributableCents: breakdown.distributableCents,
        purchasedShipmentCount: settlement.purchasedShipmentCount,
      };
    }

    const config = this.configRepository.get();
    const apiKind = resolveOrderApiKind(order);
    const segment = this.resolveSubscriberSegmentForEmail(order.ownerEmail);
    const supplier = this.resolveActiveSupplier(config, apiKind, segment);
    const purchasedShipmentCount = this.resolvePurchasedShipmentCount(order);
    const costPerShipmentCents = supplier?.costPerShipmentCents ?? 0;
    const contractedValueCents = Math.max(0, Math.round(Number(order.valueCents ?? 0)));
    const breakdown = buildSplitCostBreakdown(
      contractedValueCents,
      purchasedShipmentCount,
      costPerShipmentCents,
    );

    return {
      apiKind,
      contractedValueCents,
      supplierCostCents: breakdown.supplierCostCents,
      totalCostCents: breakdown.totalCostCents,
      grossProfitCents: breakdown.distributableCents,
      cetCents: breakdown.cetCents,
      distributableCents: breakdown.distributableCents,
      purchasedShipmentCount,
    };
  }

  getCetCentsPerOperation(): number {
    return resolveFinanceiroCetCentsPerOperation();
  }

  private logSettlementSkip(order: WabaBillingOrder, reason: string) {
    console.warn(
      `[FinanceiroSplit] pedido ${order.id} (${order.ownerEmail}) sem settlement: ${reason}`,
    );
  }

  settlePaidOrder(order: WabaBillingOrder) {
    if (order.product !== "waba-disparos" || order.status !== "paid") return null;

    if (order.grantSource === "admin-bonus-envios") {
      this.logSettlementSkip(order, "bônus de envio (sem receita do cliente)");
      return null;
    }

    if (isWabaMetricsExcludedOwnerEmail(order.ownerEmail)) {
      this.logSettlementSkip(order, "owner excluído de métricas/split");
      return null;
    }

    const existing = this.settlementRepository.getByOrderId(order.id);
    if (existing) {
      if (isWabaMetricsExcludedOwnerEmail(existing.ownerEmail)) return null;
      return existing;
    }

    const config = this.configRepository.get();
    const apiKind = resolveOrderApiKind(order);
    const masterPolicy = this.masterPolicyService.resolveForEmail(order.ownerEmail);
    const paySuppliers = !masterPolicy || masterPolicy.splitSuppliers;
    const payProfits = !masterPolicy || masterPolicy.splitProfits;
    const segment = this.resolveSubscriberSegmentForEmail(order.ownerEmail);
    const supplier = this.resolveActiveSupplier(config, apiKind, segment);
    if (paySuppliers && !supplier?.pixKey) {
      this.logSettlementSkip(order, `fornecedor ativo sem PIX para plano ${apiKind}`);
      return null;
    }

    const activeParticipants = config.participants.filter((item) => item.active);
    const purchasedShipmentCount = this.resolvePurchasedShipmentCount(order);
    const costPerShipmentCents = Math.max(
      0,
      Math.round(Number((paySuppliers ? supplier?.costPerShipmentCents : 0) ?? 0)),
    );
    const paidValueCents = Math.max(0, Math.round(Number(order.valueCents ?? 0)));
    const breakdown = buildSplitCostBreakdown(
      paidValueCents,
      purchasedShipmentCount,
      costPerShipmentCents,
    );
    const { supplierCostCents, cetCents, totalCostCents, distributableCents } = breakdown;
    const effectiveSupplierCostCents = paySuppliers ? supplierCostCents : 0;

    if (distributableCents > 0 && payProfits) {
      if (!activeParticipants.length) {
        this.logSettlementSkip(order, "lucro distribuível sem participantes ativos");
        return null;
      }
      const percentSum = activeParticipants.reduce((sum, item) => sum + item.sharePercent, 0);
      if (Math.abs(percentSum - 100) > PERCENT_SUM_TOLERANCE) {
        this.logSettlementSkip(
          order,
          `soma de percentuais inválida (${percentSum.toFixed(2)}%)`,
        );
        return null;
      }
    }

    const lines: SplitSettlementLine[] = [];

    if (cetCents > 0) {
      lines.push({
        lineKind: "cet",
        participantId: "asaas-cet",
        participantLabel: "CET Asaas",
        participantEmail: "",
        pixKey: "",
        sharePercent: 0,
        amountCents: cetCents,
        payoutStatus: "skipped",
      });
    }

    if (supplier) {
      const deferSupplierPayout = this.shouldDeferSupplierPayout(supplier);
      lines.push({
        lineKind: "supplier",
        participantId: supplier.id,
        participantLabel: supplier.name,
        participantEmail: supplier.systemUserEmail || "",
        pixKey: paySuppliers && !deferSupplierPayout ? supplier.pixKey : "",
        sharePercent: 0,
        amountCents: effectiveSupplierCostCents,
        shipmentCount: purchasedShipmentCount,
        costPerShipmentCents: paySuppliers ? costPerShipmentCents : 0,
        payoutStatus:
          paySuppliers && effectiveSupplierCostCents > 0 && !deferSupplierPayout
            ? "pending"
            : "skipped",
      });
    }

    if (distributableCents > 0 && payProfits && activeParticipants.length) {
      const percents = activeParticipants.map((item) => item.sharePercent);
      const amounts = distributeCentsByPercents(distributableCents, percents);
      for (const [index, participant] of activeParticipants.entries()) {
        const amountCents = amounts[index] ?? 0;
        lines.push({
          lineKind: "partner",
          participantId: participant.id,
          participantLabel: participant.label,
          participantEmail: participant.email,
          pixKey: participant.pixKey,
          sharePercent: participant.sharePercent,
          amountCents,
          payoutStatus: amountCents > 0 ? "pending" : "skipped",
        });
      }
    }

    return this.settlementRepository.create({
      orderId: order.id,
      apiKind,
      ownerEmail: order.ownerEmail,
      customerName: order.customerName,
      paidValueCents,
      purchasedShipmentCount,
      costPerShipmentCents,
      supplierCostCents: effectiveSupplierCostCents,
      totalCostCents,
      grossProfitCents: distributableCents,
      cetCents,
      distributableCents,
      supplierId: supplier?.id ?? "",
      supplierName: supplier?.name ?? "",
      lines,
      payoutStatus: deriveSettlementPayoutStatus(lines),
    });
  }

  async settleAndPayoutPaidOrder(order: WabaBillingOrder) {
    const settlement = this.settlePaidOrder(order);
    if (!settlement) return null;
    if (!this.payoutService.isPayoutEnabled()) return settlement;
    try {
      return await this.payoutService.executeForSettlement(settlement);
    } catch (error) {
      console.error(
        `[FinanceiroSplit] falha no repasse PIX do pedido ${order.id}:`,
        error instanceof Error ? error.message : error,
      );
      return settlement;
    }
  }

  async retryPayoutForOrder(orderId: string) {
    return this.payoutService.executeForOrderId(orderId);
  }

  async retryPayoutLineForOrder(orderId: string, participantId: string) {
    return this.payoutService.retryLineForOrder(orderId, participantId);
  }

  async getSplitLineReceiptUrl(orderId: string, participantId: string) {
    return this.payoutService.resolveLineReceiptUrl(orderId, participantId);
  }

  async processPendingPayouts(limit = 50) {
    this.absorbSyntheticCampaignSupplierSettlements();
    return this.payoutService.executePendingSettlements(limit);
  }

  async backfillUnsettledPaidOrders(limit = 200) {
    const cap = Math.max(1, Math.min(500, Math.floor(limit)));
    const paidOrders = this.orderRepository
      .list()
      .filter((order) => order.product === "waba-disparos" && order.status === "paid")
      .sort(
        (a, b) =>
          new Date(a.paidAt || a.updatedAt).getTime() -
          new Date(b.paidAt || b.updatedAt).getTime(),
      );

    let scanned = 0;
    let settled = 0;
    let payoutsTriggered = 0;

    for (const order of paidOrders) {
      if (scanned >= cap) break;
      if (this.settlementRepository.getByOrderId(order.id)) continue;
      scanned += 1;
      const result = await this.settleAndPayoutPaidOrder(order);
      if (result) {
        settled += 1;
        if (result.payoutStatus !== "pending") payoutsTriggered += 1;
      }
    }

    return { scanned, settled, payoutsTriggered, payoutEnabled: this.isPayoutEnabled() };
  }

  getSupplierById(supplierId: string): SplitSupplier | null {
    const normalized = String(supplierId || "").trim();
    if (!normalized) return null;
    return this.configRepository.get().suppliers.find((item) => item.id === normalized) ?? null;
  }

  /**
   * Fornecedor eleito para repasse PIX da campanha — usa operacional atribuído
   * (e-mail + plano + segmento) para refletir transferências entre operacionais.
   */
  resolveSupplierForCampaignIntake(intake: WabaCampaignIntake): SplitSupplier | null {
    const assignedEmail = String(intake.assignedOperacionalEmail || "")
      .trim()
      .toLowerCase();
    const assignedId = String(intake.assignedSupplierId || "").trim();
    if (!assignedEmail && !assignedId) return null;

    const apiKind = resolveIntakeApiKindFromIntake(intake);
    const subscriberSegment = this.resolveSubscriberSegmentForEmail(intake.ownerEmail);
    const supplierSegment: WabaSystemUserOperacionalSegment =
      subscriberSegment === "bets" ? "bets" : "outros";
    const suppliers = this.configRepository.get().suppliers;

    if (assignedEmail) {
      const byEmail =
        suppliers.find(
          (row) =>
            row.active &&
            row.systemUserEmail.toLowerCase() === assignedEmail &&
            row.apiKind === apiKind &&
            row.segment === supplierSegment,
        ) ??
        suppliers.find(
          (row) =>
            row.active &&
            row.systemUserEmail.toLowerCase() === assignedEmail &&
            row.apiKind === apiKind,
        ) ??
        null;
      if (byEmail) return byEmail;
    }

    if (assignedId) {
      return this.getSupplierById(assignedId);
    }
    return null;
  }

  private applyElectedSupplierToSettlement(
    settlement: FinanceiroSplitSettlement,
    supplier: SplitSupplier,
  ): FinanceiroSplitSettlement | null {
    const supplierLineIndex = settlement.lines.findIndex((line) => line.lineKind === "supplier");
    if (supplierLineIndex < 0) return null;

    const line = settlement.lines[supplierLineIndex];
    if (line.payoutStatus === "paid" || line.payoutStatus === "processing") {
      return settlement;
    }

    const participantEmail = supplier.systemUserEmail || "";
    const pixKey = supplier.pixKey || line.pixKey || "";
    const needsUpdate =
      line.participantId !== supplier.id ||
      line.pixKey !== pixKey ||
      line.participantEmail !== participantEmail ||
      line.participantLabel !== supplier.name ||
      settlement.supplierId !== supplier.id;

    if (!needsUpdate) return settlement;

    const operatorChanged = line.participantId !== supplier.id;
    const updatedLines = [...settlement.lines];
    updatedLines[supplierLineIndex] = {
      ...line,
      participantId: supplier.id,
      participantLabel: supplier.name,
      participantEmail,
      pixKey,
      payoutStatus: line.payoutStatus === "failed" ? "pending" : line.payoutStatus,
      ...(operatorChanged
        ? {
            asaasTransferId: undefined,
            payoutExternalReference: undefined,
            transactionReceiptUrl: undefined,
            paidAt: undefined,
            failureReason: undefined,
          }
        : {}),
    };

    return this.settlementRepository.save({
      ...settlement,
      supplierId: supplier.id,
      supplierName: supplier.name,
      lines: updatedLines,
      payoutStatus: deriveSettlementPayoutStatus(updatedLines),
    });
  }

  /**
   * Atualiza settlement pendente da campanha quando o operacional muda
   * (participantId, e-mail e chave PIX do fornecedor eleito).
   * Também atualiza o split do pedido pago (linha fornecedor adiada) para
   * refletir o operador da campanha vigente — cancelar e gerar outra não
   * pode deixar o Financeiro no operador antigo.
   */
  syncCampaignSupplierSettlementForIntake(
    intake: WabaCampaignIntake,
    existing?: FinanceiroSplitSettlement | null,
  ): FinanceiroSplitSettlement | null {
    const supplier = this.resolveSupplierForCampaignIntake(intake);
    if (!supplier?.pixKey) return null;

    const campaignOrderId = this.buildCampaignSupplierOrderId(intake.id);
    const campaignSettlement =
      existing ?? this.settlementRepository.getByOrderId(campaignOrderId);
    let updatedCampaign: FinanceiroSplitSettlement | null = null;
    if (campaignSettlement) {
      updatedCampaign = this.applyElectedSupplierToSettlement(campaignSettlement, supplier);
    }

    this.syncDeferredOrderSettlementsForIntake(intake, supplier);
    return updatedCampaign;
  }

  /**
   * Pedido pago congela o fornecedor no momento do PIX do assinante.
   * Se a campanha vigente mudou de operacional, a linha adiada (skipped/pending)
   * precisa seguir o eleito — sem mexer em linhas já pagas (lucro).
   */
  syncDeferredOrderSettlementsForIntake(
    intake: WabaCampaignIntake,
    supplierOverride?: SplitSupplier | null,
  ): number {
    const supplier = supplierOverride ?? this.resolveSupplierForCampaignIntake(intake);
    if (!supplier?.pixKey) return 0;

    const ownerEmail = String(intake.ownerEmail || "")
      .trim()
      .toLowerCase();
    if (!ownerEmail) return 0;
    const apiKind = resolveIntakeApiKindFromIntake(intake);
    const campaignOrderPrefix = "campaign-supplier:";
    let updated = 0;

    for (const settlement of this.settlementRepository.list(500)) {
      if (String(settlement.orderId || "").startsWith(campaignOrderPrefix)) continue;
      if (String(settlement.ownerEmail || "").trim().toLowerCase() !== ownerEmail) continue;
      if (settlement.apiKind !== apiKind) continue;
      const saved = this.applyElectedSupplierToSettlement(settlement, supplier);
      if (saved && saved !== settlement) updated += 1;
    }
    return updated;
  }

  /** Corrige splits de pedidos cuja campanha aberta já está em outro operacional. */
  syncDeferredSupplierSettlementsFromOpenCampaigns(): number {
    const intakeRepository = new WabaCampaignIntakeRepository();
    let updated = 0;
    for (const intake of intakeRepository.listAll()) {
      const status = String(intake.status || "");
      if (status !== "generated" && status !== "in_progress") continue;
      if (!String(intake.assignedOperacionalEmail || "").trim()) continue;
      updated += this.syncDeferredOrderSettlementsForIntake(intake);
    }
    return updated;
  }

  buildCampaignSupplierOrderId(intakeId: string): string {
    return `campaign-supplier:${String(intakeId || "").trim()}`;
  }

  private isCampaignSupplierOrderId(orderId: string): boolean {
    return String(orderId || "").trim().startsWith("campaign-supplier:");
  }

  private normalizeOwnerEmail(email: string): string {
    return String(email || "").trim().toLowerCase();
  }

  private findSupplierLine(settlement: FinanceiroSplitSettlement): SplitSettlementLine | undefined {
    return settlement.lines.find((line) => line.lineKind === "supplier");
  }

  private settlementMatchesSupplier(
    settlement: FinanceiroSplitSettlement,
    supplierId: string,
  ): boolean {
    if (!supplierId) return true;
    if (String(settlement.supplierId || "").trim() === supplierId) return true;
    return String(this.findSupplierLine(settlement)?.participantId || "").trim() === supplierId;
  }

  private isUnusedDeferredSupplierSettlement(settlement: FinanceiroSplitSettlement): boolean {
    if (this.isCampaignSupplierOrderId(settlement.orderId)) return false;
    const line = this.findSupplierLine(settlement);
    if (!line || line.amountCents <= 0) return false;
    if (line.payoutStatus === "paid" || line.payoutStatus === "processing") return false;
    return line.payoutStatus === "skipped" || line.payoutStatus === "pending";
  }

  private findDeferredSupplierSettlement(params: {
    ownerEmail: string;
    apiKind: WabaDispatchesApiKind;
    supplierId: string;
    campaignIntakeId?: string;
    preferredCostPerShipmentCents?: number;
    excludeSettlementIds?: Set<string>;
  }): FinanceiroSplitSettlement | null {
    const ownerEmail = this.normalizeOwnerEmail(params.ownerEmail);
    const supplierId = String(params.supplierId || "").trim();
    const campaignIntakeId = String(params.campaignIntakeId || "").trim();
    const excluded = params.excludeSettlementIds ?? new Set<string>();
    const preferredCost = Math.max(0, Math.round(Number(params.preferredCostPerShipmentCents ?? 0)));

    const all = this.settlementRepository
      .listAll()
      .filter((item) => !excluded.has(item.id))
      .filter((item) => !this.isCampaignSupplierOrderId(item.orderId))
      .filter((item) => this.normalizeOwnerEmail(item.ownerEmail) === ownerEmail)
      .filter((item) => item.apiKind === params.apiKind)
      .filter((item) => this.settlementMatchesSupplier(item, supplierId));

    if (campaignIntakeId) {
      const linked = all.find((item) => item.campaignIntakeId === campaignIntakeId);
      if (linked) return linked;
    }

    return (
      all
        .filter((item) => !item.campaignIntakeId)
        .filter((item) => this.isUnusedDeferredSupplierSettlement(item))
        .sort((a, b) => {
          if (preferredCost > 0) {
            const deltaA = Math.abs(
              Math.max(0, Math.round(Number(a.costPerShipmentCents ?? 0))) - preferredCost,
            );
            const deltaB = Math.abs(
              Math.max(0, Math.round(Number(b.costPerShipmentCents ?? 0))) - preferredCost,
            );
            if (deltaA !== deltaB) return deltaA - deltaB;
          }
          return String(a.createdAt).localeCompare(String(b.createdAt));
        })[0] ?? null
    );
  }

  private mergeSupplierPayoutIntoOriginal(
    original: FinanceiroSplitSettlement,
    sourceLine: SplitSettlementLine,
    campaignIntakeId: string,
  ): FinanceiroSplitSettlement {
    const lines = original.lines.map((line) => {
      if (line.lineKind !== "supplier") return line;
      if (line.payoutStatus === "paid") return line;
      return {
        ...line,
        pixKey: sourceLine.pixKey || line.pixKey,
        amountCents: sourceLine.amountCents || line.amountCents,
        shipmentCount: sourceLine.shipmentCount ?? line.shipmentCount,
        costPerShipmentCents: sourceLine.costPerShipmentCents ?? line.costPerShipmentCents,
        payoutStatus: sourceLine.payoutStatus,
        asaasTransferId: sourceLine.asaasTransferId,
        payoutExternalReference: sourceLine.payoutExternalReference,
        transactionReceiptUrl: sourceLine.transactionReceiptUrl,
        paidAt: sourceLine.paidAt,
        failureReason: sourceLine.failureReason,
      };
    });
    const supplierLine = lines.find((line) => line.lineKind === "supplier");
    return {
      ...original,
      campaignIntakeId: original.campaignIntakeId || campaignIntakeId,
      supplierCostCents: supplierLine?.amountCents ?? original.supplierCostCents,
      lines,
      payoutStatus: deriveSettlementPayoutStatus(lines),
    };
  }

  private absorbSyntheticCampaignSupplierSettlements(): number {
    const synthetics = this.settlementRepository
      .listAll()
      .filter((item) => this.isCampaignSupplierOrderId(item.orderId))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (!synthetics.length) return 0;

    const usedOriginalIds = new Set<string>();
    let absorbed = 0;

    for (const synthetic of synthetics) {
      const sourceLine = this.findSupplierLine(synthetic);
      if (!sourceLine) continue;

      const original = this.findDeferredSupplierSettlement({
        ownerEmail: synthetic.ownerEmail,
        apiKind: synthetic.apiKind,
        supplierId: String(synthetic.supplierId || sourceLine.participantId || "").trim(),
        campaignIntakeId: synthetic.campaignIntakeId,
        preferredCostPerShipmentCents:
          sourceLine.costPerShipmentCents ?? synthetic.costPerShipmentCents,
        excludeSettlementIds: usedOriginalIds,
      });
      if (!original) {
        console.warn(
          `[FinanceiroSplit] settlement sintético ${synthetic.orderId} sem pedido original para absorver o comprovante`,
        );
        continue;
      }

      const merged = this.mergeSupplierPayoutIntoOriginal(
        original,
        sourceLine,
        String(synthetic.campaignIntakeId || "").trim(),
      );
      this.settlementRepository.save(merged);
      this.settlementRepository.deleteByOrderIds([synthetic.orderId]);
      usedOriginalIds.add(original.id);
      absorbed += 1;
    }

    return absorbed;
  }

  private prepareDeferredSupplierLine(
    settlement: FinanceiroSplitSettlement,
    supplier: SplitSupplier,
    deliveredCount: number,
    campaignIntakeId: string,
  ): FinanceiroSplitSettlement {
    const aligned = this.applyElectedSupplierToSettlement(settlement, supplier) ?? settlement;
    const existingLine = this.findSupplierLine(aligned);
    const costPerShipmentCents = Math.max(
      0,
      Math.round(
        Number(
          existingLine?.costPerShipmentCents ??
            aligned.costPerShipmentCents ??
            supplier.costPerShipmentCents ??
            0,
        ),
      ),
    );
    const supplierCostCents = Math.max(0, Math.round(deliveredCount * costPerShipmentCents));
    const lines = aligned.lines.map((line) => {
      if (line.lineKind !== "supplier") return line;
      if (line.payoutStatus === "paid" || line.payoutStatus === "processing") return line;
      return {
        ...line,
        participantId: line.participantId || supplier.id,
        participantLabel: line.participantLabel || supplier.name,
        participantEmail: line.participantEmail || supplier.systemUserEmail || "",
        pixKey: supplier.pixKey,
        amountCents: supplierCostCents || line.amountCents,
        shipmentCount: deliveredCount || line.shipmentCount,
        costPerShipmentCents,
        payoutStatus: line.payoutStatus === "skipped" ? "pending" : line.payoutStatus,
      };
    });
    const supplierLine = lines.find((line) => line.lineKind === "supplier");
    return this.settlementRepository.save({
      ...aligned,
      campaignIntakeId: aligned.campaignIntakeId || campaignIntakeId,
      supplierCostCents: supplierLine?.amountCents ?? aligned.supplierCostCents,
      lines,
      payoutStatus: deriveSettlementPayoutStatus(lines),
    });
  }

  private async ensureSupplierPayoutOnSettlement(
    settlement: FinanceiroSplitSettlement,
    supplier: SplitSupplier,
    deliveredCount: number,
    campaignIntakeId: string,
  ): Promise<FinanceiroSplitSettlement> {
    const prepared = this.prepareDeferredSupplierLine(
      settlement,
      supplier,
      deliveredCount,
      campaignIntakeId,
    );
    const supplierLine = this.findSupplierLine(prepared);
    if (!supplierLine) return prepared;
    if (supplierLine.payoutStatus === "paid") return prepared;
    if (!this.payoutService.isPayoutEnabled()) return prepared;
    try {
      return (
        (await this.payoutService.executeSingleLine(prepared, supplierLine.participantId)) ??
        prepared
      );
    } catch (error) {
      console.error(
        `[FinanceiroSplit] falha no repasse PIX do fornecedor no pedido ${prepared.orderId}:`,
        error instanceof Error ? error.message : error,
      );
      return prepared;
    }
  }

  async payoutSupplierForCompletedCampaign(intake: WabaCampaignIntake): Promise<FinanceiroSplitSettlement | null> {
    if (intake.status !== "completed") return null;
    if (isWabaMetricsExcludedOwnerEmail(intake.ownerEmail)) return null;

    if (isBonusOnlyCampaignFunding(intake.creditFunding)) {
      console.info(
        `[FinanceiroSplit] campanha ${intake.id} ignorada no split: 100% bônus de envio`,
      );
      return null;
    }

    const deliveredCount = resolveBillableSentForSupplierSplit(intake);
    if (deliveredCount <= 0) return null;

    const supplier = this.resolveSupplierForCampaignIntake(intake);
    if (!supplier?.pixKey) return null;

    this.absorbSyntheticCampaignSupplierSettlements();
    this.syncDeferredOrderSettlementsForIntake(intake, supplier);

    const apiKind = resolveIntakeApiKindFromIntake(intake);
    const linkedCandidates = this.settlementRepository
      .listAll()
      .filter((item) => item.campaignIntakeId === intake.id)
      .sort(
        (a, b) =>
          Number(this.isCampaignSupplierOrderId(a.orderId)) -
          Number(this.isCampaignSupplierOrderId(b.orderId)),
      );
    const linked =
      linkedCandidates[0] ??
      this.settlementRepository.getByOrderId(this.buildCampaignSupplierOrderId(intake.id));

    const target =
      linked && !this.isCampaignSupplierOrderId(linked.orderId)
        ? linked
        : this.findDeferredSupplierSettlement({
            ownerEmail: intake.ownerEmail,
            apiKind,
            supplierId: supplier.id,
            campaignIntakeId: intake.id,
            preferredCostPerShipmentCents: supplier.costPerShipmentCents,
          });

    if (target && !this.isCampaignSupplierOrderId(target.orderId)) {
      if (isWabaMetricsExcludedOwnerEmail(target.ownerEmail)) return null;
      return this.ensureSupplierPayoutOnSettlement(target, supplier, deliveredCount, intake.id);
    }

    if (linked && this.isCampaignSupplierOrderId(linked.orderId)) {
      if (isWabaMetricsExcludedOwnerEmail(linked.ownerEmail)) return null;
      return this.ensureSupplierPayoutOnSettlement(linked, supplier, deliveredCount, intake.id);
    }

    const orderId = this.buildCampaignSupplierOrderId(intake.id);
    const costPerShipmentCents = Math.max(0, Math.round(Number(supplier.costPerShipmentCents ?? 0)));
    const supplierCostCents = Math.max(0, Math.round(deliveredCount * costPerShipmentCents));
    if (supplierCostCents <= 0) return null;

    const lines: SplitSettlementLine[] = [
      {
        lineKind: "supplier",
        participantId: supplier.id,
        participantLabel: supplier.name,
        participantEmail: supplier.systemUserEmail || "",
        pixKey: supplier.pixKey,
        sharePercent: 0,
        amountCents: supplierCostCents,
        shipmentCount: deliveredCount,
        costPerShipmentCents,
        payoutStatus: "pending",
      },
    ];

    const fallback = this.settlementRepository.create({
      orderId,
      campaignIntakeId: intake.id,
      apiKind,
      ownerEmail: intake.ownerEmail,
      customerName: intake.campaignName,
      paidValueCents: 0,
      purchasedShipmentCount: deliveredCount,
      costPerShipmentCents,
      supplierCostCents,
      totalCostCents: supplierCostCents,
      grossProfitCents: 0,
      cetCents: 0,
      distributableCents: 0,
      supplierId: supplier.id,
      supplierName: supplier.name,
      lines,
      payoutStatus: deriveSettlementPayoutStatus(lines),
    });

    return this.ensureSupplierPayoutOnSettlement(fallback, supplier, deliveredCount, intake.id);
  }
}
