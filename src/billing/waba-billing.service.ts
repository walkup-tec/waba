import { randomUUID } from "node:crypto";
import {
  buildAlternativaNumbersPaymentDescription,
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
import {
  WabaAlternativaNumbersService,
} from "./waba-alternativa-numbers.service";
import { WabaCouponService } from "./waba-coupon.service";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import {
  getSubscriberSegmentByEmail,
  isBetsSubscriberEmail,
} from "../subscribers/waba-subscriber-segment";

export type CreateAlternativaNumbersCheckoutInput = {
  customerName: string;
  ownerEmail: string;
  cpfCnpj: string;
  whatsapp: string;
  quantity: number;
  valueCents: number;
};

export type CreateDisparosCheckoutInput = {
  apiKind: "oficial" | "alternativa";
  customerName: string;
  ownerEmail: string;
  cpfCnpj: string;
  whatsapp: string;
  valueCents?: number;
  shipmentCount?: number;
  couponAlias?: string;
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
  { shipments: 100, valueCents: 3000 },
];

/** Tabela de venda API Oficial (envios × valor total em centavos). */
const DISPAROS_OFICIAL_SALE_PACKAGES: ReadonlyArray<{ shipments: number; valueCents: number }> = [
  { shipments: 1000, valueCents: 32000 },
  { shipments: 3000, valueCents: 93000 },
  { shipments: 5000, valueCents: 150000 },
  { shipments: 8000, valueCents: 232000 },
  { shipments: 10000, valueCents: 270000 },
  { shipments: 20000, valueCents: 520000 },
  { shipments: 30000, valueCents: 750000 },
];

/** Tabela de venda API Oficial — segmento Bets (envios × valor total em centavos). */
const DISPAROS_BETS_OFICIAL_SALE_PACKAGES: ReadonlyArray<{ shipments: number; valueCents: number }> = [
  { shipments: 1000, valueCents: 40000 },
  { shipments: 3000, valueCents: 114000 },
  { shipments: 5000, valueCents: 185000 },
  { shipments: 8000, valueCents: 288000 },
  { shipments: 10000, valueCents: 330000 },
  { shipments: 20000, valueCents: 640000 },
  { shipments: 30000, valueCents: 930000 },
];

/** Tabela de venda API Alternativa (envios × valor total em centavos). */
const DISPAROS_ALTERNATIVA_SALE_PACKAGES: ReadonlyArray<{ shipments: number; valueCents: number }> = [
  { shipments: 1000, valueCents: 20000 },
  { shipments: 3000, valueCents: 57000 },
  { shipments: 5000, valueCents: 85000 },
  { shipments: 8000, valueCents: 128000 },
  { shipments: 10000, valueCents: 150000 },
  { shipments: 20000, valueCents: 280000 },
  { shipments: 30000, valueCents: 390000 },
];

const isDisparosTestPackage = (shipmentCount: number, valueCents: number): boolean =>
  DISPAROS_TEST_PACKAGES.some(
    (pack) => pack.shipments === shipmentCount && pack.valueCents === valueCents,
  );

const isDisparosOficialSalePackage = (shipmentCount: number, valueCents: number): boolean =>
  DISPAROS_OFICIAL_SALE_PACKAGES.some(
    (pack) => pack.shipments === shipmentCount && pack.valueCents === valueCents,
  );

const isDisparosAlternativaSalePackage = (shipmentCount: number, valueCents: number): boolean =>
  DISPAROS_ALTERNATIVA_SALE_PACKAGES.some(
    (pack) => pack.shipments === shipmentCount && pack.valueCents === valueCents,
  );

const getDisparosSalePackages = (
  apiKind: "oficial" | "alternativa",
  segment: WabaSubscriberSegment = "outros",
): ReadonlyArray<{ shipments: number; valueCents: number }> => {
  if (segment === "bets") {
    if (apiKind === "alternativa") return [];
    return DISPAROS_BETS_OFICIAL_SALE_PACKAGES;
  }
  return apiKind === "oficial" ? DISPAROS_OFICIAL_SALE_PACKAGES : DISPAROS_ALTERNATIVA_SALE_PACKAGES;
};

const resolveDisparosCustomListValueCents = (
  apiKind: "oficial" | "alternativa",
  shipmentCount: number,
  segment: WabaSubscriberSegment = "outros",
): number | null => {
  const salePackages = getDisparosSalePackages(apiKind, segment);
  const lastTier = salePackages[salePackages.length - 1];
  if (!lastTier || shipmentCount <= lastTier.shipments) return null;
  const unitCents = lastTier.valueCents / lastTier.shipments;
  return Math.round(shipmentCount * unitCents);
};

const resolveListValueCentsForPackage = (
  apiKind: "oficial" | "alternativa",
  shipmentCount: number,
  segment: WabaSubscriberSegment = "outros",
): number | null => {
  if (segment === "bets" && apiKind === "alternativa") return null;
  if (shipmentCount <= 0) return null;
  const tables =
    apiKind === "oficial"
      ? segment === "bets"
        ? [...DISPAROS_TEST_PACKAGES, ...DISPAROS_BETS_OFICIAL_SALE_PACKAGES]
        : [...DISPAROS_TEST_PACKAGES, ...DISPAROS_OFICIAL_SALE_PACKAGES]
      : [...DISPAROS_TEST_PACKAGES, ...DISPAROS_ALTERNATIVA_SALE_PACKAGES];
  const match = tables.find((pack) => pack.shipments === shipmentCount);
  if (match) return match.valueCents;
  return resolveDisparosCustomListValueCents(apiKind, shipmentCount, segment);
};

const ASAAS_MIN_CHARGE_CENTS = 500;

export class WabaBillingService {
  constructor(
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly bonusSettlementService = new WabaDisparosBonusSettlementService(),
    private readonly splitService = new WabaFinanceiroSplitService(),
    private readonly alternativaNumbersService = new WabaAlternativaNumbersService(),
    private readonly couponService = new WabaCouponService(),
  ) {}

  private finalizePaidOrder(order: WabaBillingOrder): WabaBillingOrder {
    if (order.product !== "waba-disparos") {
      return order;
    }
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
      listValueCents: settled.listValueCents ?? settled.valueCents,
      discountPercent: settled.discountPercent ?? 0,
      couponAlias: settled.couponAlias ?? "",
      shipmentCount: settled.shipmentCount ?? 0,
      numberCount: settled.product === "waba-alternativa-numbers" ? settled.shipmentCount ?? 0 : 0,
      bonusShipmentsApplied: settled.bonusShipmentsApplied ?? 0,
      paymentUrl: settled.paymentUrl ?? "",
      pixCopyPaste: settled.pixCopyPaste ?? "",
      pixQrCodeBase64: settled.pixQrCodeBase64 ?? "",
      paidAt: settled.paidAt ?? "",
      updatedAt: settled.updatedAt,
      asaasExternalReference: settled.asaasExternalReference,
    };
  }

  quoteDisparosCoupon(input: {
    alias: string;
    apiKind: "oficial" | "alternativa";
    shipmentCount: number;
    ownerEmail?: string;
  }) {
    const apiKind = input.apiKind;
    if (apiKind !== "oficial" && apiKind !== "alternativa") {
      throw new Error("Selecione API Oficial ou API Alternativa.");
    }
    const segment = getSubscriberSegmentByEmail(String(input.ownerEmail ?? ""));
    if (segment === "bets" && apiKind === "alternativa") {
      throw new Error("Assinantes do segmento Bets contratam créditos apenas na API Oficial.");
    }
    const shipmentCount = Math.round(Number(input.shipmentCount ?? 0));
    const listValueCents = resolveListValueCentsForPackage(apiKind, shipmentCount, segment);
    if (!listValueCents) {
      throw new Error("Pacote de envios inválido.");
    }
    const quote = this.couponService.quoteCoupon({
      alias: input.alias,
      listValueCents,
    });
    if (quote.finalValueCents < ASAAS_MIN_CHARGE_CENTS) {
      throw new Error(
        `O valor final após desconto deve ser de pelo menos R$ ${centsToCurrency(ASAAS_MIN_CHARGE_CENTS)
          .toFixed(2)
          .replace(".", ",")}.`,
      );
    }
    return quote;
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

    const segment = getSubscriberSegmentByEmail(ownerEmail);
    if (segment === "bets" && apiKind === "alternativa") {
      throw new Error("Assinantes do segmento Bets contratam créditos apenas na API Oficial.");
    }

    const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
    if (cpfCnpj.length < 11) {
      throw new Error("Informe CPF ou CNPJ válido.");
    }

    const whatsapp = formatBrazilMobileForAsaas(String(input.whatsapp ?? ""));

    const minCreditCents = resolveMinCreditCents();
    const shipmentCount = Math.round(Number(input.shipmentCount ?? 0));
    const listValueCentsFromPackage =
      shipmentCount > 0 ? resolveListValueCentsForPackage(apiKind, shipmentCount, segment) : null;

    let listValueCents = listValueCentsFromPackage ?? Math.round(Number(input.valueCents ?? minCreditCents));
    if (!Number.isFinite(listValueCents) || listValueCents <= 0) {
      throw new Error("Valor do pacote inválido.");
    }

    if (shipmentCount > 0) {
      if (!listValueCentsFromPackage) {
        const salePackages = getDisparosSalePackages(apiKind, segment);
        const maxShipments = salePackages[salePackages.length - 1]?.shipments ?? 0;
        throw new Error(
          maxShipments > 0
            ? `Informe uma quantidade maior que ${maxShipments.toLocaleString("pt-BR")} envios.`
            : apiKind === "oficial"
              ? "Pacote de envios inválido para API Oficial."
              : "Pacote de envios inválido para API Alternativa.",
        );
      }
      listValueCents = listValueCentsFromPackage;
    } else {
      const isTestPackage = isDisparosTestPackage(shipmentCount, listValueCents);
      const effectiveMin = isTestPackage ? listValueCents : minCreditCents;
      if (listValueCents < effectiveMin) {
        throw new Error(
          `Valor mínimo de créditos: R$ ${centsToCurrency(effectiveMin).toFixed(2).replace(".", ",")}.`,
        );
      }
    }

    const couponAlias = String(input.couponAlias ?? "").trim();
    let valueCents = listValueCents;
    let discountPercent: number | undefined;
    let couponId: string | undefined;
    let normalizedCouponAlias: string | undefined;

    if (couponAlias) {
      const quote = this.couponService.quoteCoupon({ alias: couponAlias, listValueCents });
      valueCents = quote.finalValueCents;
      discountPercent = quote.discountPercent;
      couponId = quote.couponId;
      normalizedCouponAlias = quote.alias;
    }

    const isTestPackage = isDisparosTestPackage(shipmentCount, listValueCents);
    const effectiveMin = isTestPackage ? valueCents : minCreditCents;
    if (valueCents < effectiveMin && !couponAlias) {
      throw new Error(
        `Valor mínimo de créditos: R$ ${centsToCurrency(effectiveMin).toFixed(2).replace(".", ",")}.`,
      );
    }
    if (valueCents < ASAAS_MIN_CHARGE_CENTS) {
      throw new Error(
        `O valor final deve ser de pelo menos R$ ${centsToCurrency(ASAAS_MIN_CHARGE_CENTS)
          .toFixed(2)
          .replace(".", ",")}.`,
      );
    }

    return {
      apiKind,
      customerName,
      ownerEmail,
      cpfCnpj,
      whatsapp,
      valueCents,
      listValueCents,
      discountPercent,
      couponId,
      couponAlias: normalizedCouponAlias,
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
      listValueCents: validated.listValueCents,
      discountPercent: validated.discountPercent,
      couponAlias: validated.couponAlias,
      couponId: validated.couponId,
      shipmentCount: validated.shipmentCount,
      status: "pending_payment",
      asaasExternalReference,
      createdAt: now,
      updatedAt: now,
    });

    if (validated.couponId) {
      this.couponService.registerRedemption(validated.couponId);
    }

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

  private validateAlternativaNumbersCheckoutInput(input: CreateAlternativaNumbersCheckoutInput) {
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
    const { quantity, valueCents } = this.alternativaNumbersService.validateCheckout(
      input.quantity,
      input.valueCents,
    );

    return { customerName, ownerEmail, cpfCnpj, whatsapp, quantity, valueCents };
  }

  async createAlternativaNumbersPixCheckout(input: CreateAlternativaNumbersCheckoutInput) {
    if (!isAsaasConfigured()) {
      throw new Error("Pagamentos indisponíveis no momento. Configure ASAAS_API_KEY no servidor.");
    }

    const validated = this.validateAlternativaNumbersCheckoutInput(input);
    const now = new Date().toISOString();
    const orderId = randomUUID();
    const asaasExternalReference = buildWabaAsaasExternalReference(orderId);

    const order = this.orderRepository.create({
      id: orderId,
      product: "waba-alternativa-numbers",
      apiKind: "alternativa",
      customerName: validated.customerName,
      ownerEmail: validated.ownerEmail,
      whatsapp: validated.whatsapp,
      cpfCnpj: validated.cpfCnpj,
      billingType: "PIX",
      valueCents: validated.valueCents,
      shipmentCount: validated.quantity,
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
      description: buildAlternativaNumbersPaymentDescription(validated.quantity),
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
