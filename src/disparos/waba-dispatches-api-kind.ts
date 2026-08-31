import type { WabaBillingOrder } from "../billing/waba-billing-order.repository";
import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";
import type { WabaCampaignIntake } from "./waba-campaign-intake.repository";

export type WabaDispatchesApiKind = "oficial" | "alternativa";

export const WABA_DISPATCHES_API_LABELS: Record<WabaDispatchesApiKind, string> = {
  oficial: "API Oficial",
  alternativa: "API Alternativa",
};

export const normalizeDispatchesApiKind = (value: unknown): WabaDispatchesApiKind | null => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "oficial" || raw === "alternativa") return raw;
  return null;
};

const listPaidDisparosOrdersForEmail = (
  ownerEmail: string,
  orderRepository: WabaBillingOrderRepository,
): WabaBillingOrder[] => {
  const normalized = ownerEmail.trim().toLowerCase();
  return orderRepository
    .list()
    .filter(
      (order: WabaBillingOrder) =>
        order.product === "waba-disparos" &&
        order.status === "paid" &&
        order.ownerEmail.trim().toLowerCase() === normalized &&
        String(order.paidAt ?? "").trim().length > 0,
    )
    .sort(
      (a, b) =>
        new Date(b.paidAt || b.updatedAt).getTime() - new Date(a.paidAt || a.updatedAt).getTime(),
    );
};

/** Plano ativo no momento de referência (ex.: criação da campanha). */
export const resolveSubscriberDispatchesApiKindFromOrdersAt = (
  ownerEmail: string,
  atIso: string,
  orderRepository: WabaBillingOrderRepository = new WabaBillingOrderRepository(),
): WabaDispatchesApiKind => {
  const atMs = new Date(atIso).getTime();
  const paidOrders = listPaidDisparosOrdersForEmail(ownerEmail, orderRepository).filter((order) => {
    const paidMs = new Date(order.paidAt || order.updatedAt).getTime();
    return !Number.isNaN(paidMs) && paidMs <= atMs;
  });

  const latest = paidOrders[0];
  return latest?.apiKind === "alternativa" ? "alternativa" : "oficial";
};

export const resolveSubscriberDispatchesApiKindFromOrders = (
  ownerEmail: string,
  orderRepository: WabaBillingOrderRepository = new WabaBillingOrderRepository(),
): WabaDispatchesApiKind => {
  return resolveSubscriberDispatchesApiKindFromOrdersAt(
    ownerEmail,
    new Date().toISOString(),
    orderRepository,
  );
};

export const resolveOrderApiKind = (order: WabaBillingOrder): WabaDispatchesApiKind => {
  return order.apiKind === "alternativa" ? "alternativa" : "oficial";
};

export const resolveIntakeApiKindFromIntake = (intake: WabaCampaignIntake): WabaDispatchesApiKind => {
  if (intake.apiKind === "oficial" || intake.apiKind === "alternativa") {
    return intake.apiKind;
  }
  return resolveSubscriberDispatchesApiKindFromOrdersAt(intake.ownerEmail, intake.createdAt);
};
