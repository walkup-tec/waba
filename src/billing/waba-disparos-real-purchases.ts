import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { CLEISON_OFICIAL_FORCE_REF } from "./waba-cleison-oficial-balance-repair";
import { resolvePurchasedShipmentCount } from "./waba-disparos-order-shipments";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/** Preços de pacote vendido (centavos), com e sem acréscimo Cleison. */
const CATALOG_PACK_VALUE_CENTS = new Set([
  20000, 32000, 34000, 35000, 57000, 85000, 93000, 99000, 128000, 150000, 160000, 200000, 232000,
  270000, 280000, 380000, 390000, 520000, 740000, 750000, 1080000, 1400000, 1650000,
]);

export const isOperationalBalanceRepairOrder = (order: {
  asaasExternalReference?: string | null;
  grantCreatedByEmail?: string | null;
}): boolean =>
  String(order.asaasExternalReference ?? "").trim() === CLEISON_OFICIAL_FORCE_REF ||
  order.grantCreatedByEmail === "system-balance-repair";

/** Pacote vendido (1000, 3000, 5000…), não restante 1849 nem grant 1016. */
export const isCatalogSaleQuantity = (qty: number): boolean => {
  const n = Math.max(0, Math.round(Number(qty ?? 0)));
  return n >= 1000 && n % 1000 === 0;
};

const paidAtMs = (order: WabaBillingOrder): number => {
  const ms = Date.parse(String(order.paidAt ?? order.createdAt ?? ""));
  return Number.isFinite(ms) ? ms : 0;
};

const paidAtMinuteKey = (order: WabaBillingOrder): string => {
  const ms = paidAtMs(order);
  if (!ms) return "";
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}T${date.getUTCHours()}:${date.getUTCMinutes()}`;
};

const hasAsaasPaymentId = (order: WabaBillingOrder): boolean =>
  String(order.asaasPaymentId ?? "").trim().length > 0;

/**
 * Quantidade contratada da compra. Recupera 5.000 quando o pedido gravou
 * 7.679 (= 5.000 + bônus) em purchasedShipmentCount. Não trata restante
 * 2.834 − 834 = 2.000 como pacote vendido.
 */
export const resolveRealPurchasedShipmentCount = (order: WabaBillingOrder): number => {
  const purchased = resolvePurchasedShipmentCount(order);
  const total = Math.max(0, Math.round(Number(order.shipmentCount ?? 0)));
  const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
  if (isCatalogSaleQuantity(purchased)) return purchased;
  if (isCatalogSaleQuantity(total)) return total;

  const recovered = [purchased - applied, total - applied].find(isCatalogSaleQuantity) ?? 0;
  const valueCents = Math.max(0, Math.round(Number(order.valueCents ?? 0)));
  if (recovered && (hasAsaasPaymentId(order) || CATALOG_PACK_VALUE_CENTS.has(valueCents))) {
    return recovered;
  }
  const fromPrice = catalogQtyFromValueCents(valueCents, order.apiKind);
  if (fromPrice > 0 && (hasAsaasPaymentId(order) || CATALOG_PACK_VALUE_CENTS.has(valueCents))) {
    return fromPrice;
  }
  return 0;
};

const catalogQtyFromValueCents = (valueCents: number, apiKind?: string): number => {
  if (valueCents <= 0) return 0;
  if (apiKind === "alternativa") {
    if (valueCents === 20000) return 1000;
    if (valueCents === 57000) return 3000;
    if (valueCents === 85000) return 5000;
    if (valueCents === 128000) return 8000;
    if (valueCents === 150000) return 10000;
    if (valueCents === 280000) return 20000;
    if (valueCents === 390000) return 30000;
    return 0;
  }
  if (valueCents === 32000 || valueCents === 34000 || valueCents === 35000) return 1000;
  if (valueCents === 93000 || valueCents === 99000) return 3000;
  if (valueCents === 150000 || valueCents === 160000 || valueCents === 200000) return 5000;
  if (valueCents === 232000) return 8000;
  if (valueCents === 270000 || valueCents === 380000) return 10000;
  if (valueCents === 520000 || valueCents === 740000) return 20000;
  if (valueCents === 750000 || valueCents === 1080000) return 30000;
  return 0;
};

/**
 * Compras reais do assinante: pacotes pagos, sem freeze, sem grant, sem restante
 * e sem clones criados no mesmo minuto do force-balance.
 */
export const listRealPaidPurchases = (
  orders: WabaBillingOrder[],
  email: string,
): WabaBillingOrder[] => {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];

  const paid = orders
    .filter(
      (order) =>
        order.product === "waba-disparos" &&
        order.status === "paid" &&
        normalizeEmail(order.ownerEmail) === normalized &&
        String(order.paidAt ?? "").trim().length > 0,
    )
    .sort((a, b) => paidAtMs(b) - paidAtMs(a));

  const freezeMinutes = new Set(
    paid.filter((order) => isOperationalBalanceRepairOrder(order)).map(paidAtMinuteKey).filter(Boolean),
  );

  const catalog = paid.filter((order) => {
    if (order.grantSource === "admin-bonus-envios") return false;
    if (isOperationalBalanceRepairOrder(order)) return false;
    const minute = paidAtMinuteKey(order);
    if (minute && freezeMinutes.has(minute)) return false;
    return resolveRealPurchasedShipmentCount(order) > 0;
  });

  const qtyHasAsaas = new Set<number>();
  for (const order of catalog) {
    if (hasAsaasPaymentId(order)) {
      qtyHasAsaas.add(resolveRealPurchasedShipmentCount(order));
    }
  }

  const oldestFirst = [...catalog].sort((a, b) => paidAtMs(a) - paidAtMs(b));
  const seenPaymentIds = new Set<string>();
  const unique: WabaBillingOrder[] = [];

  for (const order of oldestFirst) {
    const purchased = resolveRealPurchasedShipmentCount(order);
    const paymentId = String(order.asaasPaymentId ?? "").trim();
    if (!paymentId && qtyHasAsaas.has(purchased)) continue;
    if (paymentId) {
      if (seenPaymentIds.has(paymentId)) continue;
      seenPaymentIds.add(paymentId);
    }
    unique.push(order);
  }

  return unique.sort((a, b) => paidAtMs(b) - paidAtMs(a));
};

export const sumPurchasedShipments = (orders: WabaBillingOrder[]): number =>
  orders.reduce((sum, order) => sum + resolveRealPurchasedShipmentCount(order), 0);
