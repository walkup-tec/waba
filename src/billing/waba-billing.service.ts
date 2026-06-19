import { randomUUID } from "node:crypto";
import {
  buildWabaAsaasExternalReference,
  buildWabaPaymentDescription,
  isWabaAsaasExternalReference,
  parseWabaOrderIdFromExternalReference,
  WABA_ASAAS_PRODUCT,
} from "./asaas-identifiers";
import {
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasPayment,
  getAsaasPixQrCode,
  isAsaasConfigured,
  resolveAsaasPaymentUrl,
} from "./asaas.client";
import { formatBrazilMobileForAsaas } from "./phone";
import { WabaDisparosBonusSettlementService } from "./waba-disparos-bonus-settlement.service";
import { WabaFinanceiroSplitService } from "./waba-financeiro-split.service";
import { WabaBillingOrderRepository, type WabaBillingOrder } from "./waba-billing-order.repository";

export type CreateDisparosCheckoutInput = {
  apiKind: "oficial" | "alternativa";
  customerName: string;
  ownerEmail: string;
  cpfCnpj: string;
  whatsapp: string;
  valueCents?: number;
  shipmentCount?: number;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

const formatDueDate = (daysAhead: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const centsToCurrency = (valueCents: number): number => Number((valueCents / 100).toFixed(2));

const isPaidAsaasStatus = (status: string | undefined): boolean => {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "RECEIVED" || normalized === "CONFIRMED" || normalized === "RECEIVED_IN_CASH";
};

const resolveMinCreditCents = (): number => {
  const raw = Number(process.env.WABA_DISPAROS_MIN_CREDIT_CENTS ?? 30000);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 30000;
};

/** Pacotes de teste (100 envios) — valores abaixo do mínimo comercial. */
const DISPAROS_TEST_PACKAGES: ReadonlyArray<{ shipments: number; valueCents: number }> = [
  { shipments: 100, valueCents: 500 },
  { shipments: 100, valueCents: 3000 },
];

const isDisparosTestPackage = (shipmentCount: number, valueCents: number): boolean =>
  DISPAROS_TEST_PACKAGES.some(
    (pack) => pack.shipments === shipmentCount && pack.valueCents === valueCents,
  );

export class WabaBillingService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly bonusSettlementService = new WabaDisparosBonusSettlementService(),
    private readonly splitService = new WabaFinanceiroSplitService(),
  ) {}

  private finalizePaidOrder(order: WabaBillingOrder): WabaBillingOrder {
    const settled = this.bonusSettlementService.settlePaidOrder(order);
    void this.splitService.settleAndPayoutPaidOrder(settled).catch((error) => {
      console.error(
        `[FinanceiroSplit] erro ao liquidar/repassar pedido ${settled.id}:`,
        error instanceof Error ? error.message : error,
      );
    });
    return settled;
  }

  getDisparosConfig() {
    return {
      product: WABA_ASAAS_PRODUCT,
      paymentConfigured: isAsaasConfigured(),
      minCreditCents: resolveMinCreditCents(),
      minCreditLabel: centsToCurrency(resolveMinCreditCents()).toFixed(2).replace(".", ","),
      asaasOrderPrefix: "waba:",
    };
  }

  getOrderStatus(orderId: string) {
    const order = this.orderRepository.getById(orderId);
    if (!order) return null;
    return this.toPublicOrder(order);
  }

  listPaidDisparosOrders() {
    return this.orderRepository
      .list()
      .filter((order) => order.product === "waba-disparos" && order.status === "paid")
      .map((order) => this.toPublicOrder(order));
  }

  private toPublicOrder(order: WabaBillingOrder) {
    const settled =
      order.product === "waba-disparos" && order.status === "paid"
        ? this.bonusSettlementService.settlePaidOrder(order)
        : order;
    return {
      id: settled.id,
      product: settled.product,
      apiKind: settled.apiKind,
      status: settled.status,
      valueCents: settled.valueCents,
      shipmentCount: settled.shipmentCount ?? 0,
      bonusShipmentsApplied: settled.bonusShipmentsApplied ?? 0,
      paymentUrl: settled.paymentUrl ?? "",
      pixCopyPaste: settled.pixCopyPaste ?? "",
      pixQrCodeBase64: settled.pixQrCodeBase64 ?? "",
      paidAt: settled.paidAt ?? "",
      updatedAt: settled.updatedAt,
      asaasExternalReference: settled.asaasExternalReference,
    };
  }

  private validateCheckoutInput(input: CreateDisparosCheckoutInput) {
    const apiKind = input.apiKind;
    if (apiKind !== "oficial" && apiKind !== "alternativa") {
      throw new Error("Selecione API Oficial ou API Alternativa.");
    }

    const customerName = String(input.customerName ?? "").trim();
    if (customerName.length < 2) {
      throw new Error("Informe o nome completo.");
    }

    const ownerEmail = normalizeEmail(String(input.ownerEmail ?? ""));
    if (!ownerEmail.includes("@")) {
      throw new Error("Informe um e-mail válido.");
    }

    const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
    if (cpfCnpj.length < 11) {
      throw new Error("Informe CPF ou CNPJ válido.");
    }

    const whatsapp = formatBrazilMobileForAsaas(String(input.whatsapp ?? ""));

    const minCreditCents = resolveMinCreditCents();
    const valueCents = Math.round(Number(input.valueCents ?? minCreditCents));
    const shipmentCount = Math.round(Number(input.shipmentCount ?? 0));
    const isTestPackage = isDisparosTestPackage(shipmentCount, valueCents);
    const effectiveMin = isTestPackage ? valueCents : minCreditCents;
    if (!Number.isFinite(valueCents) || valueCents < effectiveMin) {
      throw new Error(
        `Valor mínimo de créditos: R$ ${centsToCurrency(effectiveMin).toFixed(2).replace(".", ",")}.`,
      );
    }

    return {
      apiKind,
      customerName,
      ownerEmail,
      cpfCnpj,
      whatsapp,
      valueCents,
      shipmentCount: shipmentCount > 0 ? shipmentCount : undefined,
    };
  }

  async createDisparosPixCheckout(input: CreateDisparosCheckoutInput) {
    if (!isAsaasConfigured()) {
      throw new Error("Pagamentos indisponíveis no momento. Configure ASAAS_API_KEY no servidor.");
    }

    const validated = this.validateCheckoutInput(input);
    const now = new Date().toISOString();
    const orderId = randomUUID();
    const asaasExternalReference = buildWabaAsaasExternalReference(orderId);

    const order = this.orderRepository.create({
      id: orderId,
      product: "waba-disparos",
      apiKind: validated.apiKind,
      customerName: validated.customerName,
      ownerEmail: validated.ownerEmail,
      whatsapp: validated.whatsapp,
      cpfCnpj: validated.cpfCnpj,
      billingType: "PIX",
      valueCents: validated.valueCents,
      shipmentCount: validated.shipmentCount,
      status: "pending_payment",
      asaasExternalReference,
      createdAt: now,
      updatedAt: now,
    });

    const customer = await createAsaasCustomer({
      name: order.customerName,
      email: order.ownerEmail,
      mobilePhone: order.whatsapp,
      cpfCnpj: order.cpfCnpj,
      externalReference: asaasExternalReference,
    });

    const payment = await createAsaasPayment({
      customerId: customer.id,
      billingType: "PIX",
      value: centsToCurrency(order.valueCents),
      dueDate: formatDueDate(1),
      description: validated.shipmentCount
        ? `${buildWabaPaymentDescription(order.apiKind)} · ${validated.shipmentCount.toLocaleString("pt-BR")} envios`
        : buildWabaPaymentDescription(order.apiKind),
      externalReference: asaasExternalReference,
    });

    const paymentUrl = resolveAsaasPaymentUrl(payment);
    let pixCopyPaste = "";
    let pixQrCodeBase64 = "";

    try {
      const pix = await getAsaasPixQrCode(payment.id);
      pixCopyPaste = String(pix.payload ?? "").trim();
      pixQrCodeBase64 = String(pix.encodedImage ?? "").trim();
    } catch {
      /* invoiceUrl continua disponível como fallback */
    }

    const updated =
      this.orderRepository.update(order.id, {
        asaasCustomerId: customer.id,
        asaasPaymentId: payment.id,
        paymentUrl,
        pixCopyPaste,
        pixQrCodeBase64,
      }) ?? order;

    return this.toPublicOrder(updated);
  }

  async reconcileOrderPayment(orderId: string) {
    const order = this.orderRepository.getById(orderId);
    if (!order) return null;

    const paymentId = String(order.asaasPaymentId ?? "").trim();
    if (!paymentId) return this.getOrderStatus(order.id);

    const payment = await getAsaasPayment(paymentId);
    const paymentUrl = resolveAsaasPaymentUrl(payment) || String(order.paymentUrl ?? "").trim();

    if (!isPaidAsaasStatus(payment.status)) {
      this.orderRepository.update(order.id, { paymentUrl });
      return this.getOrderStatus(order.id);
    }

    const paidOrder =
      this.orderRepository.update(order.id, {
        status: "paid",
        paidAt: new Date().toISOString(),
        paymentUrl,
      }) ?? order;

    return this.toPublicOrder(this.finalizePaidOrder(paidOrder));
  }

  async handleAsaasWebhook(
    event: string,
    payment: { id?: string; externalReference?: string; status?: string },
  ) {
    const normalizedEvent = String(event ?? "").trim().toUpperCase();
    const paymentId = String(payment.id ?? "").trim();
    const paymentExternalReference = String(payment.externalReference ?? "").trim();

    if (paymentExternalReference && !isWabaAsaasExternalReference(paymentExternalReference)) {
      return { ignored: true, reason: "externalReference não é WABA" };
    }

    let order: WabaBillingOrder | null = null;
    if (paymentId) {
      order = this.orderRepository.getByAsaasPaymentId(paymentId);
    }
    if (!order && paymentExternalReference) {
      order = this.orderRepository.getByAsaasExternalReference(paymentExternalReference);
      if (!order) {
        const orderId = parseWabaOrderIdFromExternalReference(paymentExternalReference);
        if (orderId) order = this.orderRepository.getById(orderId);
      }
    }
    if (!order) {
      return { ignored: true, reason: "pedido WABA não encontrado" };
    }

    if (normalizedEvent === "PAYMENT_OVERDUE") {
      this.orderRepository.update(order.id, { status: "cancelled" });
      return { ok: true, orderId: order.id, status: "cancelled" };
    }

    if (
      normalizedEvent === "PAYMENT_RECEIVED" ||
      normalizedEvent === "PAYMENT_CONFIRMED" ||
      isPaidAsaasStatus(payment.status)
    ) {
      const paid =
        this.orderRepository.update(order.id, {
          status: "paid",
          paidAt: new Date().toISOString(),
          asaasPaymentId: paymentId || order.asaasPaymentId,
        }) ?? order;
      const settled = this.finalizePaidOrder(paid);
      return { ok: true, orderId: settled.id, status: settled.status };
    }

    return { ok: true, orderId: order.id, status: order.status, event: normalizedEvent };
  }
}
