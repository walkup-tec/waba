import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import {
  WabaBillingOrderRepository,
  type WabaBillingOrder,
  type WabaBillingOrderStatus,
} from "../billing/waba-billing-order.repository";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "../disparos/waba-campaign-intake.repository";
import { resolveOrderShipmentCount } from "../billing/waba-disparos-order-shipments";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import {
  WabaSubscriberService,
  type UpdateSubscriberInput,
} from "../subscribers/waba-subscriber.service";
import {
  deliverSubscriberWelcomeEmail,
  type WabaEmailDeliveryResult,
} from "../mail/waba-mail-delivery";
import {
  deliverSubscriberWelcomeWhatsApp,
  type WabaWhatsAppDeliveryResult,
} from "../mail/waba-welcome-whatsapp.service";

export type AdminSubscriberListItem = {
  id: string;
  email: string;
  fullName: string;
  cpfCnpj: string;
  cpfCnpjFormatted: string;
  createdAt: string;
  createdAtLabel: string;
  creditsValueCents: number;
  creditsValueLabel: string;
  contractedShipments: number;
  campaignsAwaiting: number;
  campaignsCompleted: number;
};

export type AdminSubscriberPurchaseHistoryItem = {
  id: string;
  product: string;
  productLabel: string;
  apiKind: string;
  apiKindLabel: string;
  valueCents: number;
  valueLabel: string;
  quantity: number;
  quantityLabel: string;
  bonusShipmentsApplied: number;
  status: WabaBillingOrderStatus;
  statusLabel: string;
  paidAt: string;
  paidAtLabel: string;
  createdAt: string;
  createdAtLabel: string;
  couponAlias: string;
};

export type AdminSubscriberDetail = {
  profile: {
    id: string;
    email: string;
    fullName: string;
    cpfCnpj: string;
    cpfCnpjFormatted: string;
    whatsapp: string;
    whatsappFormatted: string;
    phone: string;
    phoneFormatted: string;
    aquecedorGranted: boolean;
    createdAt: string;
    createdAtLabel: string;
    updatedAt: string;
    updatedAtLabel: string;
  };
  summary: {
    creditsValueCents: number;
    creditsValueLabel: string;
    contractedShipments: number;
    campaignsAwaiting: number;
    campaignsCompleted: number;
  };
  purchaseHistory: AdminSubscriberPurchaseHistoryItem[];
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const formatCpfCnpj = (raw: string): string => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits || "—";
};

const formatCreatedAtLabel = (iso: string): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoneyFromCents = (cents: number): string => {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatPhoneDisplay = (raw: string): string => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return digits || "—";
};

const resolveProductLabel = (product: string): string => {
  if (product === "waba-alternativa-numbers") return "Números API Alternativa";
  return "Créditos de disparos";
};

const resolveApiKindLabel = (apiKind: string): string =>
  apiKind === "alternativa" ? "API Alternativa" : "API Oficial";

const resolveOrderStatusLabel = (status: WabaBillingOrderStatus): string => {
  if (status === "paid") return "Pago";
  if (status === "pending_payment") return "Aguardando pagamento";
  if (status === "cancelled") return "Cancelado";
  if (status === "failed") return "Falhou";
  return status;
};

const resolvePurchaseQuantityLabel = (order: WabaBillingOrder): { quantity: number; label: string } => {
  const quantity = Math.max(0, Math.round(Number(resolveOrderShipmentCount(order) || 0)));
  const bonus = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
  if (order.product === "waba-alternativa-numbers") {
    return {
      quantity,
      label: quantity === 1 ? "1 número" : `${quantity.toLocaleString("pt-BR")} números`,
    };
  }
  const base = quantity === 1 ? "1 envio" : `${quantity.toLocaleString("pt-BR")} envios`;
  if (bonus > 0) {
    return {
      quantity,
      label: `${base} (+${bonus.toLocaleString("pt-BR")} bônus)`,
    };
  }
  return { quantity, label: base };
};

const normalizeIntakeStatus = (status: string): string =>
  String(status || "")
    .trim()
    .toLowerCase();

const isCampaignAwaiting = (intake: WabaCampaignIntake): boolean => {
  const status = normalizeIntakeStatus(intake.status);
  return status === "generated" || status === "pending_review" || status === "in_progress";
};

const isCampaignCompleted = (intake: WabaCampaignIntake): boolean =>
  normalizeIntakeStatus(intake.status) === "completed";

const summarizePaidDisparosOrders = (
  orders: WabaBillingOrder[],
): { contractedValueCents: number; contractedShipments: number } => {
  let contractedValueCents = 0;
  let contractedShipments = 0;

  for (const order of orders) {
    contractedValueCents += Math.max(0, Math.round(Number(order.valueCents ?? 0)));
    contractedShipments += Math.max(0, Math.round(Number(resolveOrderShipmentCount(order) || 0)));
  }

  return { contractedValueCents, contractedShipments };
};

export class WabaAdminSubscribersService {
  constructor(
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly subscriberService = new WabaSubscriberService(),
    private readonly creditsService = new WabaDisparosCreditsService(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
  ) {}

  private buildPaidDisparosOrdersByEmail(): Map<string, WabaBillingOrder[]> {
    const byEmail = new Map<string, WabaBillingOrder[]>();

    for (const order of this.orderRepository.list()) {
      if (order.product !== "waba-disparos" || order.status !== "paid") continue;
      if (!String(order.paidAt ?? "").trim()) continue;

      const email = normalizeEmail(order.ownerEmail);
      if (!email) continue;

      const bucket = byEmail.get(email) ?? [];
      bucket.push(order);
      byEmail.set(email, bucket);
    }

    return byEmail;
  }

  listSubscribers(): AdminSubscriberListItem[] {
    const intakesByEmail = new Map<string, WabaCampaignIntake[]>();
    for (const intake of this.intakeRepository.listAll()) {
      const email = normalizeEmail(intake.ownerEmail);
      if (!email) continue;
      const bucket = intakesByEmail.get(email) ?? [];
      bucket.push(intake);
      intakesByEmail.set(email, bucket);
    }

    const paidDisparosByEmail = this.buildPaidDisparosOrdersByEmail();

    return this.subscriberRepository
      .list()
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((subscriber) => {
        const email = normalizeEmail(subscriber.email);
        const credits = summarizePaidDisparosOrders(paidDisparosByEmail.get(email) ?? []);
        const intakes = intakesByEmail.get(email) ?? [];

        return {
          id: subscriber.id,
          email,
          fullName: subscriber.fullName,
          cpfCnpj: subscriber.cpfCnpj,
          cpfCnpjFormatted: formatCpfCnpj(subscriber.cpfCnpj),
          createdAt: subscriber.createdAt,
          createdAtLabel: formatCreatedAtLabel(subscriber.createdAt),
          creditsValueCents: credits.contractedValueCents,
          creditsValueLabel: formatMoneyFromCents(credits.contractedValueCents),
          contractedShipments: credits.contractedShipments,
          campaignsAwaiting: intakes.filter(isCampaignAwaiting).length,
          campaignsCompleted: intakes.filter(isCampaignCompleted).length,
        };
      });
  }

  getSubscriberDetail(subscriberId: string): AdminSubscriberDetail {
    const id = String(subscriberId ?? "").trim();
    if (!id) throw new Error("Assinante inválido.");
    const subscriber = this.subscriberRepository.getById(id);
    if (!subscriber) throw new Error("Assinante não encontrado.");

    const email = normalizeEmail(subscriber.email);
    const credits = this.creditsService.getCreditsSummary(email);
    const intakes = this.intakeRepository.listByEmail(email);

    return {
      profile: {
        id: subscriber.id,
        email,
        fullName: subscriber.fullName,
        cpfCnpj: subscriber.cpfCnpj,
        cpfCnpjFormatted: formatCpfCnpj(subscriber.cpfCnpj),
        whatsapp: subscriber.whatsapp,
        whatsappFormatted: formatPhoneDisplay(subscriber.whatsapp),
        phone: subscriber.phone,
        phoneFormatted: formatPhoneDisplay(subscriber.phone || subscriber.whatsapp),
        aquecedorGranted: Boolean(subscriber.aquecedorGranted),
        createdAt: subscriber.createdAt,
        createdAtLabel: formatCreatedAtLabel(subscriber.createdAt),
        updatedAt: subscriber.updatedAt,
        updatedAtLabel: formatCreatedAtLabel(subscriber.updatedAt),
      },
      summary: {
        creditsValueCents: credits.contractedValueCents,
        creditsValueLabel: formatMoneyFromCents(credits.contractedValueCents),
        contractedShipments: credits.contractedShipments,
        campaignsAwaiting: intakes.filter(isCampaignAwaiting).length,
        campaignsCompleted: intakes.filter(isCampaignCompleted).length,
      },
      purchaseHistory: this.listPurchaseHistory(email),
    };
  }

  updateSubscriber(subscriberId: string, input: UpdateSubscriberInput): AdminSubscriberDetail {
    this.subscriberService.update(subscriberId, input);
    return this.getSubscriberDetail(subscriberId);
  }

  async resendSubscriberWelcome(
    subscriberId: string,
    password: string,
  ): Promise<{
    email: WabaEmailDeliveryResult;
    whatsapp: WabaWhatsAppDeliveryResult;
  }> {
    const id = String(subscriberId || "").trim();
    if (!id) throw new Error("Assinante inválido.");
    const subscriber = this.subscriberRepository.getById(id);
    if (!subscriber) throw new Error("Assinante não encontrado.");

    const plainPassword = String(password ?? "").trim();
    if (plainPassword.length < 6) {
      throw new Error("Informe a senha de acesso (mín. 6 caracteres) para reenviar as boas-vindas.");
    }

    const payload = {
      email: subscriber.email,
      fullName: subscriber.fullName,
      password: plainPassword,
      whatsapp: subscriber.whatsapp,
      phone: subscriber.phone ?? subscriber.whatsapp,
      cpfCnpj: subscriber.cpfCnpj,
    };

    const [email, whatsapp] = await Promise.all([
      deliverSubscriberWelcomeEmail(payload),
      deliverSubscriberWelcomeWhatsApp({
        email: payload.email,
        password: payload.password,
        whatsapp: payload.whatsapp,
      }),
    ]);

    return { email, whatsapp };
  }

  private listPurchaseHistory(email: string, limit = 50): AdminSubscriberPurchaseHistoryItem[] {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];

    return this.orderRepository
      .list()
      .filter(
        (order) =>
          normalizeEmail(order.ownerEmail) === normalized &&
          (order.status === "paid" || order.status === "pending_payment"),
      )
      .sort((a, b) => {
        const aTime = new Date(String(a.paidAt || a.createdAt || 0)).getTime();
        const bTime = new Date(String(b.paidAt || b.createdAt || 0)).getTime();
        return bTime - aTime;
      })
      .slice(0, Math.max(1, Math.min(100, Math.floor(limit))))
      .map((order) => {
        const quantity = resolvePurchaseQuantityLabel(order);
        return {
          id: order.id,
          product: order.product,
          productLabel: resolveProductLabel(order.product),
          apiKind: order.apiKind,
          apiKindLabel: resolveApiKindLabel(order.apiKind),
          valueCents: Math.max(0, Math.round(Number(order.valueCents ?? 0))),
          valueLabel: formatMoneyFromCents(order.valueCents),
          quantity: quantity.quantity,
          quantityLabel: quantity.label,
          bonusShipmentsApplied: Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))),
          status: order.status,
          statusLabel: resolveOrderStatusLabel(order.status),
          paidAt: String(order.paidAt ?? ""),
          paidAtLabel: order.paidAt ? formatCreatedAtLabel(order.paidAt) : "—",
          createdAt: order.createdAt,
          createdAtLabel: formatCreatedAtLabel(order.createdAt),
          couponAlias: String(order.couponAlias ?? "").trim(),
        };
      });
  }
}
