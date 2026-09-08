import { randomUUID } from "node:crypto";
import { resolveAsaasPixKeyType, type AsaasPixAddressKeyType } from "../billing/asaas-pix-key";
import { toNonNegativeCents } from "../billing/waba-money-cents";
import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";
import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSubscriberService } from "../subscribers/waba-subscriber.service";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import { WabaIndicatorAuditRepository } from "./waba-indicator-audit.repository";
import {
  WabaIndicatorCommissionRepository,
  type IndicatorCommissionStatus,
  type WabaIndicatorCommission,
} from "./waba-indicator-commission.repository";
import {
  WabaIndicatorProfileRepository,
  type IndicatorProfileStatus,
} from "./waba-indicator-profile.repository";

const INDICATOR_BONUS_CAP = 100;

const normalizeEmail = (value: string): string => String(value ?? "").trim().toLowerCase();
const normalizeDigits = (value: string): string => String(value ?? "").replace(/\D/g, "");

const formatMoneyFromCents = (cents: number): string => {
  const value = Math.max(0, Math.round(Number(cents ?? 0))) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDateLabel = (iso: string): string => {
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

const STATUS_LABELS: Record<IndicatorCommissionStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  paid: "Pago",
  failed: "Falhou",
  canceled: "Cancelado",
};

export type CreateIndicatorInput = {
  fullName: string;
  email: string;
  password: string;
  whatsapp?: unknown;
  cpfCnpj?: unknown;
  pixKey: string;
  pixKeyType?: unknown;
  spreadCentsPerSend: unknown;
  status?: unknown;
};

export type UpdateIndicatorInput = {
  fullName?: string;
  email?: string;
  password?: string;
  whatsapp?: unknown;
  cpfCnpj?: unknown;
  pixKey?: string;
  pixKeyType?: unknown;
  spreadCentsPerSend?: unknown;
  status?: unknown;
};

export class WabaIndicatorService {
  constructor(
    private readonly systemUserService = new WabaSystemUserService(),
    private readonly profileRepository = new WabaIndicatorProfileRepository(),
    private readonly commissionRepository = new WabaIndicatorCommissionRepository(),
    private readonly auditRepository = new WabaIndicatorAuditRepository(),
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly subscriberService = new WabaSubscriberService(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly creditsService = new WabaDisparosCreditsService(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
  ) {}

  private parsePixKeyType(pixKey: string, explicit?: unknown): AsaasPixAddressKeyType {
    const raw = String(explicit ?? "").trim().toUpperCase();
    if (raw === "CPF" || raw === "CNPJ" || raw === "EMAIL" || raw === "PHONE" || raw === "EVP") {
      return raw;
    }
    return resolveAsaasPixKeyType(pixKey);
  }

  private parseStatus(value: unknown, fallback: IndicatorProfileStatus = "active"): IndicatorProfileStatus {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "inactive" || raw === "inativo") return "inactive";
    if (raw === "active" || raw === "ativo") return "active";
    return fallback;
  }

  getProfileByUserId(userId: string) {
    return this.profileRepository.getByUserId(userId);
  }

  getProfileByEmail(email: string) {
    const user = this.systemUserService.getByEmail(normalizeEmail(email));
    if (!user || user.role !== "indicador") return null;
    return this.profileRepository.getByUserId(user.id);
  }

  requireIndicatorUserIdByEmail(email: string): string {
    const user = this.systemUserService.getByEmail(normalizeEmail(email));
    if (!user || user.role !== "indicador") {
      throw new Error("Sessão de indicador inválida.");
    }
    const profile = this.profileRepository.getByUserId(user.id);
    if (!profile) throw new Error("Perfil de indicador não encontrado.");
    return user.id;
  }

  assertOwnsSubscriber(indicatorUserId: string, subscriberId: string) {
    const subscriber = this.subscriberRepository.getById(String(subscriberId ?? "").trim());
    if (!subscriber || String(subscriber.indicatorUserId ?? "") !== indicatorUserId) {
      throw new Error("Assinante não encontrado.");
    }
    return subscriber;
  }

  assertOwnsSubscriberEmail(indicatorUserId: string, email: string) {
    const subscriber = this.subscriberRepository.getByEmail(normalizeEmail(email));
    if (!subscriber || String(subscriber.indicatorUserId ?? "") !== indicatorUserId) {
      throw new Error("Assinante não encontrado.");
    }
    return subscriber;
  }

  listForMaster() {
    const users = this.systemUserService.listPublicUsers().filter((item) => item.role === "indicador");
    const commissions = this.commissionRepository.list();
    const subscribers = this.subscriberRepository.list();
    return users.map((user) => {
      const profile = this.profileRepository.getByUserId(user.id);
      const linked = subscribers.filter((item) => item.indicatorUserId === user.id);
      const ownCommissions = commissions.filter((item) => item.indicatorUserId === user.id);
      const generated = ownCommissions
        .filter((item) => item.status !== "canceled")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0);
      const pending = ownCommissions
        .filter((item) => item.status === "pending" || item.status === "processing")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0);
      const paid = ownCommissions
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0);
      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        whatsapp: user.whatsapp,
        cpfCnpj: profile?.cpfCnpj ?? "",
        pixKey: profile?.pixKey ?? "",
        pixKeyType: profile?.pixKeyType ?? "",
        spreadCentsPerSend: profile?.spreadCentsPerSend ?? 0,
        spreadLabel: formatMoneyFromCents(profile?.spreadCentsPerSend ?? 0),
        status: profile?.status ?? "inactive",
        statusLabel: (profile?.status ?? "inactive") === "active" ? "Ativo" : "Inativo",
        subscriberCount: linked.length,
        commissionGeneratedCents: generated,
        commissionGeneratedLabel: formatMoneyFromCents(generated),
        commissionPendingCents: pending,
        commissionPendingLabel: formatMoneyFromCents(pending),
        commissionPaidCents: paid,
        commissionPaidLabel: formatMoneyFromCents(paid),
        createdAt: user.createdAt,
        createdAtLabel: user.createdAtLabel,
      };
    });
  }

  getForMaster(userId: string) {
    const list = this.listForMaster();
    const item = list.find((entry) => entry.id === userId);
    if (!item) throw new Error("Indicador não encontrado.");
    return {
      ...item,
      subscribers: this.listSubscribersForIndicator(userId),
      commissions: this.listCommissionsForIndicator(userId, {}),
    };
  }

  createForMaster(input: CreateIndicatorInput, actor: { userId: string; email: string }) {
    const pixKey = String(input.pixKey ?? "").trim();
    if (pixKey.length < 5) throw new Error("Informe a chave PIX do indicador.");
    const spreadCentsPerSend = toNonNegativeCents(input.spreadCentsPerSend);
    const user = this.systemUserService.create({
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      whatsapp: input.whatsapp,
      role: "indicador",
    });
    const now = new Date().toISOString();
    const profile = this.profileRepository.create({
      id: randomUUID(),
      userId: user.id,
      cpfCnpj: normalizeDigits(String(input.cpfCnpj ?? "")),
      pixKey,
      pixKeyType: this.parsePixKeyType(pixKey, input.pixKeyType),
      spreadCentsPerSend,
      status: this.parseStatus(input.status, "active"),
      createdAt: now,
      updatedAt: now,
    });
    this.auditRepository.append({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "indicator.create",
      entityType: "indicator",
      entityId: user.id,
      previousValue: null,
      nextValue: { spreadCentsPerSend: profile.spreadCentsPerSend, pixKey: profile.pixKey, status: profile.status },
    });
    return this.getForMaster(user.id);
  }

  updateForMaster(userId: string, input: UpdateIndicatorInput, actor: { userId: string; email: string }) {
    const user = this.systemUserService.getByEmail(
      this.systemUserService.listPublicUsers().find((item) => item.id === userId)?.email || "",
    );
    const publicUser = this.systemUserService.listPublicUsers().find((item) => item.id === userId);
    if (!publicUser || publicUser.role !== "indicador") throw new Error("Indicador não encontrado.");
    const previous = this.profileRepository.getByUserId(userId);
    this.systemUserService.update(userId, {
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      whatsapp: input.whatsapp,
    });
    const pixKey = input.pixKey !== undefined ? String(input.pixKey ?? "").trim() : previous?.pixKey ?? "";
    if (input.pixKey !== undefined && pixKey.length < 5) {
      throw new Error("Informe a chave PIX do indicador.");
    }
    const patch = {
      cpfCnpj:
        input.cpfCnpj !== undefined ? normalizeDigits(String(input.cpfCnpj ?? "")) : previous?.cpfCnpj,
      pixKey,
      pixKeyType:
        input.pixKey !== undefined || input.pixKeyType !== undefined
          ? this.parsePixKeyType(pixKey, input.pixKeyType ?? previous?.pixKeyType)
          : previous?.pixKeyType,
      spreadCentsPerSend:
        input.spreadCentsPerSend !== undefined
          ? toNonNegativeCents(input.spreadCentsPerSend)
          : previous?.spreadCentsPerSend,
      status: input.status !== undefined ? this.parseStatus(input.status, previous?.status) : previous?.status,
      updatedAt: new Date().toISOString(),
    };
    this.profileRepository.updateByUserId(userId, patch);
    this.auditRepository.append({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "indicator.update",
      entityType: "indicator",
      entityId: userId,
      previousValue: previous
        ? { spreadCentsPerSend: previous.spreadCentsPerSend, pixKey: previous.pixKey, status: previous.status }
        : null,
      nextValue: {
        spreadCentsPerSend: patch.spreadCentsPerSend,
        pixKey: patch.pixKey,
        status: patch.status,
      },
    });
    void user;
    return this.getForMaster(userId);
  }

  listSubscribersForIndicator(indicatorUserId: string) {
    const intakes = this.intakeRepository.listAll();
    const orders = this.orderRepository.list().filter((order) => order.product === "waba-disparos" && order.status === "paid");
    const commissions = this.commissionRepository.listByIndicatorUserId(indicatorUserId);
    return this.subscriberRepository
      .list()
      .filter((item) => item.indicatorUserId === indicatorUserId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((subscriber) => {
        const email = normalizeEmail(subscriber.email);
        const credits = this.creditsService.getCreditsSummary(email);
        const ownIntakes = intakes.filter((item) => normalizeEmail(item.ownerEmail) === email);
        const purchased = orders
          .filter((order) => normalizeEmail(order.ownerEmail) === email && order.grantSource !== "admin-bonus-envios")
          .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.shipmentCount ?? 0) - Number(order.bonusShipmentsApplied ?? 0))), 0);
        const commissionCents = commissions
          .filter((item) => item.subscriberId === subscriber.id && item.status !== "canceled")
          .reduce((sum, item) => sum + item.commissionAmountCents, 0);
        return {
          id: subscriber.id,
          email,
          fullName: subscriber.fullName,
          statusLabel: "Ativo",
          contractedShipments: purchased,
          remainingShipments: credits.remainingShipments,
          campaigns: ownIntakes.length,
          remainingBonusQuota: this.remainingBonusQuota(subscriber.id),
          commissionGeneratedCents: commissionCents,
          commissionGeneratedLabel: formatMoneyFromCents(commissionCents),
          createdAt: subscriber.createdAt,
          createdAtLabel: formatDateLabel(subscriber.createdAt),
        };
      });
  }

  createSubscriberForIndicator(
    indicatorUserId: string,
    input: {
      email: string;
      password: string;
      fullName: string;
      whatsapp: string;
      phone?: string;
      cpfCnpj: string;
      segment?: WabaSubscriberSegment | unknown;
    },
    actor: { userId: string; email: string },
  ) {
    const profile = this.profileRepository.getByUserId(indicatorUserId);
    if (!profile || profile.status !== "active") {
      throw new Error("Indicador inativo não pode cadastrar assinantes.");
    }
    const subscriber = this.subscriberService.register({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      whatsapp: input.whatsapp,
      phone: input.phone ?? "",
      cpfCnpj: input.cpfCnpj,
      segment: input.segment,
      indicatorUserId,
    });
    this.auditRepository.append({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "subscriber.link",
      entityType: "subscriber",
      entityId: subscriber.id,
      previousValue: null,
      nextValue: { indicatorUserId },
    });
    return subscriber;
  }

  linkSubscriberForMaster(
    subscriberId: string,
    indicatorUserId: string | null,
    actor: { userId: string; email: string },
  ) {
    const subscriber = this.subscriberRepository.getById(String(subscriberId ?? "").trim());
    if (!subscriber) throw new Error("Assinante não encontrado.");
    const previous = String(subscriber.indicatorUserId ?? "") || null;
    const next = String(indicatorUserId ?? "").trim() || null;
    if (next) {
      const profile = this.profileRepository.getByUserId(next);
      if (!profile) throw new Error("Indicador não encontrado.");
    }
    this.subscriberRepository.update(subscriber.id, { indicatorUserId: next });
    this.auditRepository.append({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "subscriber.link",
      entityType: "subscriber",
      entityId: subscriber.id,
      previousValue: { indicatorUserId: previous },
      nextValue: { indicatorUserId: next },
    });
    return this.subscriberRepository.getById(subscriber.id);
  }

  remainingBonusQuota(subscriberId: string): number {
    const subscriber = this.subscriberRepository.getById(subscriberId);
    if (!subscriber) return 0;
    const email = normalizeEmail(subscriber.email);
    const granted = this.orderRepository
      .list()
      .filter(
        (order) =>
          order.grantSource === "admin-bonus-envios" &&
          normalizeEmail(order.ownerEmail) === email,
      )
      .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.shipmentCount ?? 0))), 0);
    return Math.max(0, INDICATOR_BONUS_CAP - granted);
  }

  assertIndicatorBonusGrant(indicatorUserId: string, subscriberId: string, shipmentCount: number) {
    this.assertOwnsSubscriber(indicatorUserId, subscriberId);
    const remaining = this.remainingBonusQuota(subscriberId);
    const qty = Math.max(0, Math.round(Number(shipmentCount ?? 0)));
    if (qty > remaining) {
      throw new Error(
        remaining <= 0
          ? "Limite de 100 envios bônus esgotado para este assinante."
          : `Restam apenas ${remaining} envios bônus para este assinante.`,
      );
    }
    return remaining;
  }

  dashboard(indicatorUserId: string, periodDays = 30) {
    const since = Date.now() - Math.max(1, periodDays) * 24 * 60 * 60 * 1000;
    const subscribers = this.subscriberRepository
      .list()
      .filter((item) => item.indicatorUserId === indicatorUserId);
    const emails = new Set(subscribers.map((item) => normalizeEmail(item.email)));
    const intakes = this.intakeRepository.listAll().filter((item) => emails.has(normalizeEmail(item.ownerEmail)));
    const commissions = this.commissionRepository.listByIndicatorUserId(indicatorUserId);
    const inPeriod = (iso: string) => Date.parse(iso) >= since;
    const statusOf = (intake: WabaCampaignIntake) => String(intake.status || "").toLowerCase();
    const generated = commissions.filter((item) => item.status !== "canceled");
    return {
      subscribers: {
        total: subscribers.length,
        active: subscribers.length,
        newInPeriod: subscribers.filter((item) => inPeriod(item.createdAt)).length,
      },
      campaigns: {
        total: intakes.length,
        processing: intakes.filter((item) => statusOf(item) === "in_progress" || statusOf(item) === "generated").length,
        completed: intakes.filter((item) => statusOf(item) === "completed").length,
        failed: intakes.filter((item) => statusOf(item) === "error_reported").length,
      },
      shipments: {
        contracted: this.orderRepository
          .list()
          .filter(
            (order) =>
              emails.has(normalizeEmail(order.ownerEmail)) &&
              order.product === "waba-disparos" &&
              order.status === "paid" &&
              order.grantSource !== "admin-bonus-envios",
          )
          .reduce(
            (sum, order) =>
              sum +
              Math.max(
                0,
                Math.round(Number(order.shipmentCount ?? 0) - Number(order.bonusShipmentsApplied ?? 0)),
              ),
            0,
          ),
        consumed: intakes.reduce(
          (sum, intake) => sum + Math.max(0, Math.round(Number(intake.performanceReport?.sent ?? 0))),
          0,
        ),
      },
      finance: {
        generatedCents: generated.reduce((sum, item) => sum + item.commissionAmountCents, 0),
        pendingCents: generated
          .filter((item) => item.status === "pending" || item.status === "processing")
          .reduce((sum, item) => sum + item.commissionAmountCents, 0),
        paidCents: generated
          .filter((item) => item.status === "paid")
          .reduce((sum, item) => sum + item.commissionAmountCents, 0),
        periodCents: generated
          .filter((item) => inPeriod(item.createdAt))
          .reduce((sum, item) => sum + item.commissionAmountCents, 0),
      },
    };
  }

  listCommissionsForIndicator(
    indicatorUserId: string,
    filters: { status?: string; subscriberId?: string; from?: string; to?: string },
  ) {
    const status = String(filters.status ?? "").trim().toLowerCase();
    const subscriberId = String(filters.subscriberId ?? "").trim();
    const fromMs = filters.from ? Date.parse(filters.from) : NaN;
    const toMs = filters.to ? Date.parse(filters.to) : NaN;
    const subscribers = new Map(
      this.subscriberRepository.list().map((item) => [item.id, item] as const),
    );
    return this.commissionRepository
      .listByIndicatorUserId(indicatorUserId)
      .filter((item) => {
        if (status && item.status !== status) return false;
        if (subscriberId && item.subscriberId !== subscriberId) return false;
        const created = Date.parse(item.createdAt);
        if (Number.isFinite(fromMs) && created < fromMs) return false;
        if (Number.isFinite(toMs) && created > toMs) return false;
        return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((item) => this.toPublicCommission(item, subscribers.get(item.subscriberId)?.fullName || item.subscriberEmail));
  }

  getCommissionForIndicator(indicatorUserId: string, commissionId: string) {
    const item = this.commissionRepository.getById(commissionId);
    if (!item || item.indicatorUserId !== indicatorUserId) {
      throw new Error("Comissão não encontrada.");
    }
    const subscriber = this.subscriberRepository.getById(item.subscriberId);
    return this.toPublicCommission(item, subscriber?.fullName || item.subscriberEmail);
  }

  private toPublicCommission(item: WabaIndicatorCommission, subscriberName: string) {
    return {
      id: item.id,
      createdAt: item.createdAt,
      createdAtLabel: formatDateLabel(item.createdAt),
      subscriberId: item.subscriberId,
      subscriberName,
      subscriberEmail: item.subscriberEmail,
      orderId: item.orderId,
      campaignId: item.campaignId,
      quantity: item.quantity,
      spreadUnitPriceCents: item.spreadUnitPriceCents,
      spreadUnitPriceLabel: formatMoneyFromCents(item.spreadUnitPriceCents),
      commissionAmountCents: item.commissionAmountCents,
      commissionAmountLabel: formatMoneyFromCents(item.commissionAmountCents),
      status: item.status,
      statusLabel: STATUS_LABELS[item.status],
      paidAt: item.paidAt,
      paidAtLabel: item.paidAt ? formatDateLabel(item.paidAt) : "—",
      payoutExternalReference: item.payoutExternalReference,
      asaasTransferId: item.asaasTransferId,
      hasReceipt: Boolean(item.transactionReceiptUrl),
      failureReason: item.failureReason,
    };
  }

  getReceiptForIndicator(indicatorUserId: string, commissionId: string) {
    const item = this.commissionRepository.getById(commissionId);
    if (!item || item.indicatorUserId !== indicatorUserId) {
      throw new Error("Comprovante não encontrado.");
    }
    if (!item.transactionReceiptUrl) {
      throw new Error("Comprovante ainda não disponível.");
    }
    return { url: item.transactionReceiptUrl, transferId: item.asaasTransferId };
  }

  listAllCommissionsForMaster(filters: { status?: string; indicatorUserId?: string; from?: string; to?: string }) {
    const status = String(filters.status ?? "").trim().toLowerCase();
    const indicatorUserId = String(filters.indicatorUserId ?? "").trim();
    const fromMs = filters.from ? Date.parse(filters.from) : NaN;
    const toMs = filters.to ? Date.parse(filters.to) : NaN;
    const subscribers = new Map(this.subscriberRepository.list().map((item) => [item.id, item] as const));
    const indicators = new Map(
      this.systemUserService.listPublicUsers().map((item) => [item.id, item] as const),
    );
    return this.commissionRepository
      .list()
      .filter((item) => {
        if (status && item.status !== status) return false;
        if (indicatorUserId && item.indicatorUserId !== indicatorUserId) return false;
        const created = Date.parse(item.createdAt);
        if (Number.isFinite(fromMs) && created < fromMs) return false;
        if (Number.isFinite(toMs) && created > toMs) return false;
        return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((item) => ({
        ...this.toPublicCommission(item, subscribers.get(item.subscriberId)?.fullName || item.subscriberEmail),
        indicatorName: indicators.get(item.indicatorUserId)?.fullName || "Indicador",
        indicatorEmail: indicators.get(item.indicatorUserId)?.email || "",
      }));
  }

  listAllLinkedSubscribersForMaster() {
    const indicators = new Map(
      this.systemUserService.listPublicUsers().map((item) => [item.id, item] as const),
    );
    return this.subscriberRepository
      .list()
      .filter((item) => String(item.indicatorUserId ?? "").trim())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((subscriber) => {
        const indicator = indicators.get(String(subscriber.indicatorUserId ?? ""));
        return {
          id: subscriber.id,
          fullName: subscriber.fullName,
          email: subscriber.email,
          indicatorUserId: subscriber.indicatorUserId,
          indicatorName: indicator?.fullName || "—",
          createdAtLabel: formatDateLabel(subscriber.createdAt),
        };
      });
  }

  financeSummary(indicatorUserId: string, filters: { status?: string; subscriberId?: string; from?: string; to?: string }) {
    const items = this.listCommissionsForIndicator(indicatorUserId, filters);
    const generated = items.filter((item) => item.status !== "canceled");
    return {
      generatedCents: generated.reduce((sum, item) => sum + item.commissionAmountCents, 0),
      pendingCents: generated
        .filter((item) => item.status === "pending" || item.status === "processing")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0),
      paidCents: generated
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + item.commissionAmountCents, 0),
      items,
    };
  }
}

export const INDICATOR_BONUS_LIMIT = INDICATOR_BONUS_CAP;
