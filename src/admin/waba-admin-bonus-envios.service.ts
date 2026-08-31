import { randomUUID } from "node:crypto";
import {
  WabaBillingOrderRepository,
  type WabaBillingOrder,
} from "../billing/waba-billing-order.repository";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import { normalizeDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import { isOrderCreditsActive } from "../billing/waba-disparos-order-shipments";
import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";

export type BonusEnviosValidityMode = "12h" | "24h" | "custom" | "lifetime";

export type GrantBonusEnviosInput = {
  subscriberId?: string;
  email?: string;
  shipmentCount: number;
  apiKind: WabaDispatchesApiKind | string;
  validityMode: BonusEnviosValidityMode;
  validUntil?: string;
  createdByEmail: string;
};

export type PublicBonusEnviosItem = {
  id: string;
  ownerEmail: string;
  customerName: string;
  apiKind: WabaDispatchesApiKind;
  apiKindLabel: string;
  shipmentCount: number;
  validityMode: BonusEnviosValidityMode | string;
  creditsValidUntil: string | null;
  grantActive: boolean;
  validNow: boolean;
  createdByEmail: string;
  createdAt: string;
  paidAt: string;
};

export type GrantBonusEnviosResult = {
  ok: true;
  order: PublicBonusEnviosItem;
  credits: {
    remainingShipments: number;
    contractedShipments: number;
    pendingBonusShipments: number;
  };
  subscriber: {
    id: string;
    email: string;
    fullName: string;
  };
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const addHours = (iso: string, hours: number): string => {
  const date = new Date(iso);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
};

const resolveValidityWindow = (
  mode: BonusEnviosValidityMode,
  createdAt: string,
  customUntil?: string,
): { validFrom: string; validUntil: string | null } => {
  if (mode === "lifetime") {
    return { validFrom: createdAt, validUntil: null };
  }
  if (mode === "12h") {
    return { validFrom: createdAt, validUntil: addHours(createdAt, 12) };
  }
  if (mode === "24h") {
    return { validFrom: createdAt, validUntil: addHours(createdAt, 24) };
  }
  const until = String(customUntil ?? "").trim();
  if (!until) {
    throw new Error("Informe a data de validade personalizada dos envios.");
  }
  const parsed = new Date(until);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data de validade personalizada inválida.");
  }
  const minUntilMs = Date.now() + 60_000;
  if (parsed.getTime() < minUntilMs) {
    throw new Error("A validade personalizada deve ser pelo menos 1 minuto no futuro.");
  }
  return { validFrom: createdAt, validUntil: parsed.toISOString() };
};

const resolveApiKindLabel = (apiKind: WabaDispatchesApiKind): string =>
  apiKind === "alternativa" ? "API Alternativa" : "API Oficial";

const isBonusGrantOrder = (order: WabaBillingOrder): boolean =>
  order.product === "waba-disparos" && order.grantSource === "admin-bonus-envios";

export class WabaAdminBonusEnviosService {
  constructor(
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly creditsService = new WabaDisparosCreditsService(),
  ) {}

  private toPublicItem(order: WabaBillingOrder): PublicBonusEnviosItem {
    const apiKind = normalizeDispatchesApiKind(order.apiKind) ?? "oficial";
    const grantActive = order.grantActive !== false;
    return {
      id: order.id,
      ownerEmail: normalizeEmail(order.ownerEmail),
      customerName: String(order.customerName || "").trim() || "Assinante",
      apiKind,
      apiKindLabel: resolveApiKindLabel(apiKind),
      shipmentCount: Math.max(0, Math.round(Number(order.shipmentCount ?? 0))),
      validityMode: String(order.validityMode || (order.creditsValidUntil ? "custom" : "lifetime")),
      creditsValidUntil: order.creditsValidUntil ? String(order.creditsValidUntil) : null,
      grantActive,
      validNow: isOrderCreditsActive(order),
      createdByEmail: normalizeEmail(String(order.grantCreatedByEmail || "")),
      createdAt: String(order.createdAt || ""),
      paidAt: String(order.paidAt || order.createdAt || ""),
    };
  }

  listPublicGrants(): PublicBonusEnviosItem[] {
    return this.orderRepository
      .list()
      .filter(isBonusGrantOrder)
      .sort((a, b) => Date.parse(String(b.createdAt || 0)) - Date.parse(String(a.createdAt || 0)))
      .map((order) => this.toPublicItem(order));
  }

  deactivateGrant(grantId: string): PublicBonusEnviosItem {
    const id = String(grantId ?? "").trim();
    if (!id) throw new Error("Bônus de envios inválido.");
    const current = this.orderRepository.getById(id);
    if (!current || !isBonusGrantOrder(current)) {
      throw new Error("Bônus de envios não encontrado.");
    }
    const updated = this.orderRepository.update(id, { grantActive: false });
    if (!updated) throw new Error("Bônus de envios não encontrado.");
    return this.toPublicItem(updated);
  }

  grant(input: GrantBonusEnviosInput): GrantBonusEnviosResult {
    const createdByEmail = normalizeEmail(input.createdByEmail);
    if (!createdByEmail.includes("@")) {
      throw new Error("E-mail do master inválido.");
    }

    const subscriberId = String(input.subscriberId ?? "").trim();
    const emailHint = normalizeEmail(String(input.email ?? ""));
    const subscriber = subscriberId
      ? this.subscriberRepository.getById(subscriberId)
      : emailHint
        ? this.subscriberRepository.getByEmail(emailHint)
        : null;

    if (!subscriber) {
      throw new Error("Assinante não encontrado.");
    }

    const ownerEmail = normalizeEmail(subscriber.email);
    if (!ownerEmail.includes("@")) {
      throw new Error("Assinante sem e-mail válido.");
    }

    const shipmentCount = Math.max(0, Math.round(Number(input.shipmentCount)));
    if (!Number.isFinite(shipmentCount) || shipmentCount <= 0) {
      throw new Error("Informe a quantidade de envios a creditar (mínimo 1).");
    }
    if (shipmentCount > 5_000_000) {
      throw new Error("Quantidade de envios acima do limite permitido.");
    }

    const apiKind = normalizeDispatchesApiKind(input.apiKind);
    if (!apiKind) {
      throw new Error("Selecione o tipo de plano (API Oficial ou API Alternativa).");
    }

    const segment = String(subscriber.segment ?? "outros").trim().toLowerCase();
    if (segment === "bets" && apiKind === "alternativa") {
      throw new Error("Assinantes do segmento Bets recebem créditos apenas na API Oficial.");
    }

    const validityMode = input.validityMode;
    if (!["12h", "24h", "custom", "lifetime"].includes(validityMode)) {
      throw new Error("Selecione uma validade válida para o bônus de envios.");
    }

    const now = new Date().toISOString();
    const { validUntil } = resolveValidityWindow(validityMode, now, input.validUntil);
    const id = randomUUID();

    const order: WabaBillingOrder = {
      id,
      product: "waba-disparos",
      apiKind,
      customerName: String(subscriber.fullName || "Assinante").trim() || "Assinante",
      ownerEmail,
      whatsapp: String(subscriber.whatsapp || subscriber.phone || "").trim(),
      cpfCnpj: String(subscriber.cpfCnpj || "").trim(),
      billingType: "PIX",
      valueCents: 0,
      shipmentCount,
      status: "paid",
      asaasExternalReference: `waba:bonus-envios:${id}`,
      createdAt: now,
      updatedAt: now,
      paidAt: now,
      bonusShipmentsApplied: 0,
      bonusSettlementAt: now,
      grantSource: "admin-bonus-envios",
      grantCreatedByEmail: createdByEmail,
      grantActive: true,
      creditsValidUntil: validUntil,
      validityMode,
    };

    this.orderRepository.create(order);

    const credits = this.creditsService.getCreditsSummary(ownerEmail);
    const bucket = credits.byApi[apiKind];

    return {
      ok: true,
      order: this.toPublicItem(order),
      credits: {
        remainingShipments: bucket.remainingShipments,
        contractedShipments: bucket.contractedShipments,
        pendingBonusShipments: bucket.pendingBonusShipments,
      },
      subscriber: {
        id: subscriber.id,
        email: ownerEmail,
        fullName: subscriber.fullName,
      },
    };
  }
}
