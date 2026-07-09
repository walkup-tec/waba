import { isAsaasConfigured, probeAsaasTransferPermission } from "../billing/asaas.client";
import { resolveFinanceiroCetCentsPerOperation } from "../billing/waba-financeiro-cet";
import { resolveOrderApiKind, type WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import { isWabaMasterEmail } from "../auth/waba-auth.service";
import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import { WabaBillingOrderRepository, type WabaBillingOrder } from "../billing/waba-billing-order.repository";
import { WabaBillingService } from "../billing/waba-billing.service";
import { WabaSystemUserService } from "../users/waba-system-user.service";

const maskApiBaseUrl = (raw: string): string => {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "—";
  try {
    const url = new URL(value);
    return `${url.origin}/v3`;
  } catch {
    return value.replace(/\/v3\/?$/, "/v3");
  }
};

const resolveWebhookPublicUrl = (): string => {
  const appUrl = String(process.env.WABA_APP_LOGIN_URL ?? "").trim().replace(/\/$/, "");
  const basePath = String(process.env.WABA_BASE_PATH ?? "").trim().replace(/\/$/, "");
  if (appUrl) return `${appUrl}/webhooks/asaas`;
  if (basePath) return `${basePath}/webhooks/asaas`;
  return "/webhooks/asaas";
};

const resolveTransferAuthWebhookPublicUrl = (): string => {
  const appUrl = String(process.env.WABA_APP_LOGIN_URL ?? "").trim().replace(/\/$/, "");
  const basePath = String(process.env.WABA_BASE_PATH ?? "").trim().replace(/\/$/, "");
  if (appUrl) return `${appUrl}/webhooks/asaas/transfer-authorization`;
  if (basePath) return `${basePath}/webhooks/asaas/transfer-authorization`;
  return "/webhooks/asaas/transfer-authorization";
};

export class WabaAdminFinanceiroService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly billingService = new WabaBillingService(),
    private readonly splitService = new WabaFinanceiroSplitService(),
    private readonly systemUserService = new WabaSystemUserService(),
  ) {}

  private toAdminOrder(order: WabaBillingOrder) {
    const publicOrder = this.billingService.getOrderStatus(order.id);
    return {
      ...(publicOrder ?? {
        id: order.id,
        product: order.product,
        apiKind: order.apiKind,
        status: order.status,
        valueCents: order.valueCents,
        shipmentCount: order.shipmentCount ?? 0,
        bonusShipmentsApplied: order.bonusShipmentsApplied ?? 0,
        paymentUrl: order.paymentUrl ?? "",
        pixCopyPaste: order.pixCopyPaste ?? "",
        paidAt: order.paidAt ?? "",
        updatedAt: order.updatedAt,
        asaasExternalReference: order.asaasExternalReference,
      }),
      customerName: order.customerName,
      ownerEmail: order.ownerEmail,
      whatsapp: order.whatsapp,
      cpfCnpj: order.cpfCnpj,
      createdAt: order.createdAt,
      asaasPaymentId: order.asaasPaymentId ?? "",
    };
  }

  private listMasterUsersForSplit() {
    const seen = new Set<string>();
    const items: Array<{ id: string; fullName: string; email: string }> = [];

    for (const user of this.systemUserService.listPublicUsers()) {
      const email = String(user.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      if (user.role !== "master" && !isWabaMasterEmail(email)) continue;
      seen.add(email);
      items.push({
        id: user.id,
        fullName: String(user.fullName || email).trim() || email,
        email,
      });
    }

    const envMasterEmail = String(process.env.WABA_ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (envMasterEmail && !seen.has(envMasterEmail)) {
      items.unshift({
        id: "env-master",
        fullName: envMasterEmail,
        email: envMasterEmail,
      });
    }

    return items.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }

  private listOperacionalUsersForSuppliers() {
    const seen = new Set<string>();
    const items: Array<{
      id: string;
      fullName: string;
      email: string;
      apiKind: WabaDispatchesApiKind | null;
      segment: "bets" | "outros";
      segmentLabel: string;
      apiKindLabel: string;
    }> = [];

    for (const user of this.systemUserService.listPublicUsers()) {
      if (user.role !== "operacional") continue;
      const email = String(user.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const apiKind = user.operacionalDispatchesApi ?? null;
      const segment = user.operacionalSegment === "bets" ? "bets" : "outros";
      items.push({
        id: user.id,
        fullName: String(user.fullName || email).trim() || email,
        email,
        apiKind,
        segment,
        segmentLabel: segment === "bets" ? "Bets" : "Outros",
        apiKindLabel: apiKind === "alternativa" ? "API Alternativa" : apiKind === "oficial" ? "API Oficial" : "—",
      });
    }

    return items.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  }

  private buildProductMetrics(orders: WabaBillingOrder[]) {
    const emptyBucket = () => ({
      contractedValueCents: 0,
      totalCostCents: 0,
      supplierCostCents: 0,
      cetCents: 0,
      otherCostCents: 0,
      grossProfitCents: 0,
      paidOrderCount: 0,
    });

    const metrics: Record<WabaDispatchesApiKind, ReturnType<typeof emptyBucket>> = {
      oficial: emptyBucket(),
      alternativa: emptyBucket(),
    };

    for (const order of orders) {
      if (order.status !== "paid") continue;
      const economics = this.splitService.resolveOrderEconomics(order);
      if (!economics) continue;
      const apiKind = resolveOrderApiKind(order);
      const bucket = metrics[apiKind];
      const supplierCostCents = Math.max(0, Math.round(Number(economics.supplierCostCents ?? 0)));
      let cetCents = Math.max(0, Math.round(Number(economics.cetCents ?? 0)));
      let totalCostCents = Math.max(0, Math.round(Number(economics.totalCostCents ?? 0)));
      let normalizedSupplier = supplierCostCents;
      if (totalCostCents > 0 && normalizedSupplier + cetCents <= 0) {
        normalizedSupplier = totalCostCents;
      }
      const otherCostCents = Math.max(0, totalCostCents - normalizedSupplier - cetCents);
      bucket.contractedValueCents += economics.contractedValueCents;
      bucket.totalCostCents += totalCostCents;
      bucket.supplierCostCents += normalizedSupplier;
      bucket.cetCents += cetCents;
      bucket.otherCostCents += otherCostCents;
      bucket.grossProfitCents += economics.distributableCents;
      bucket.paidOrderCount += 1;
    }

    return {
      oficial: { apiKind: "oficial" as const, label: "API Oficial", ...metrics.oficial },
      alternativa: {
        apiKind: "alternativa" as const,
        label: "API Alternativa",
        ...metrics.alternativa,
      },
    };
  }

  private listDisparosOrdersSorted() {
    return this.orderRepository
      .list()
      .filter((order) => order.product === "waba-disparos")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  listOrders(params?: { limit?: number; offset?: number }) {
    const limitRaw = Number(params?.limit ?? 10);
    const offsetRaw = Number(params?.offset ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 10;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const filtered = this.listDisparosOrdersSorted().filter((order) => order.status === "paid");
    const slice = filtered.slice(offset, offset + limit);

    return {
      items: slice.map((order) => ({
        ...this.toAdminOrder(order),
        splitSettlement: this.splitService.getSettlementByOrderId(order.id),
      })),
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + slice.length < filtered.length,
    };
  }

  async getOverview() {
    const disparosConfig = this.billingService.getDisparosConfig();
    const asaasApiBaseUrl = String(process.env.ASAAS_API_BASE_URL ?? "").trim();
    const webhookTokenConfigured = Boolean(String(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ?? "").trim());
    const transferProbe = await probeAsaasTransferPermission();

    const orders = this.listDisparosOrdersSorted();

    await this.splitService.syncSettlementTransferStatuses(100);

    let pendingCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;
    let pendingValueCents = 0;
    let paidValueCents = 0;

    for (const order of orders) {
      if (order.status === "paid") {
        paidCount += 1;
        paidValueCents += order.valueCents;
      } else if (order.status === "pending_payment") {
        pendingCount += 1;
        pendingValueCents += order.valueCents;
      } else if (order.status === "cancelled" || order.status === "failed") {
        cancelledCount += 1;
      }
    }

    return {
      config: {
        product: disparosConfig.product,
        paymentConfigured: isAsaasConfigured(),
        minCreditCents: disparosConfig.minCreditCents,
        minCreditLabel: disparosConfig.minCreditLabel,
        asaasOrderPrefix: disparosConfig.asaasOrderPrefix,
        asaasApiBaseUrl: maskApiBaseUrl(asaasApiBaseUrl || "https://api-sandbox.asaas.com/v3"),
        asaasEnvironment: asaasApiBaseUrl.includes("sandbox") ? "sandbox" : "production",
        webhookTokenConfigured,
        webhookPublicUrl: resolveWebhookPublicUrl(),
        transferAuthWebhookPublicUrl: resolveTransferAuthWebhookPublicUrl(),
        cetCentsPerOperation: resolveFinanceiroCetCentsPerOperation(),
      },
      summary: {
        totalOrders: orders.length,
        pendingCount,
        paidCount,
        cancelledCount,
        pendingValueCents,
        paidValueCents,
      },
      productMetrics: this.buildProductMetrics(orders),
      masterUsers: this.listMasterUsersForSplit(),
      operacionalUsers: this.listOperacionalUsersForSuppliers(),
      splitConfig: this.splitService.getConfig(),
      splitSettlements: this.splitService.listSettlements(100),
      splitPayoutEnabled: this.splitService.isPayoutEnabled(),
      splitTransferProbe: transferProbe,
    };
  }
}
