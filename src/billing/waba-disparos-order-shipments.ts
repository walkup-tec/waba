import type { WabaBillingOrder } from "./waba-billing-order.repository";

export const resolveOrderShipmentCount = (order: WabaBillingOrder): number => {
  const explicit = Math.round(Number(order.shipmentCount ?? 0));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const valueCents = Math.round(Number(order.valueCents ?? 0));
  if (valueCents <= 0) return 0;
  return Math.max(1, Math.round(valueCents / 30));
};

/** Pedidos de grant desativados ou com validade expirada não entram no Disponível. */
export const isOrderCreditsActive = (order: WabaBillingOrder, nowMs = Date.now()): boolean => {
  if (order.grantSource === "admin-bonus-envios" && order.grantActive === false) {
    return false;
  }
  const until = String(order.creditsValidUntil ?? "").trim();
  if (!until) return true;
  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs)) return true;
  return nowMs <= untilMs;
};

export const resolveActiveOrderShipmentCount = (
  order: WabaBillingOrder,
  nowMs = Date.now(),
): number => {
  if (!isOrderCreditsActive(order, nowMs)) return 0;
  return resolveOrderShipmentCount(order);
};
