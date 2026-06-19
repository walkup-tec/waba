import type { WabaBillingOrder } from "./waba-billing-order.repository";

export const resolveOrderShipmentCount = (order: WabaBillingOrder): number => {
  const explicit = Math.round(Number(order.shipmentCount ?? 0));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const valueCents = Math.round(Number(order.valueCents ?? 0));
  if (valueCents <= 0) return 0;
  return Math.max(1, Math.round(valueCents / 30));
};
