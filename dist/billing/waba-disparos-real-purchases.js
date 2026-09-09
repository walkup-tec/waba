"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumPurchasedShipments = exports.listRealPaidPurchases = exports.resolveRealPurchasedShipmentCount = exports.isCatalogSaleQuantity = exports.isOperationalBalanceRepairOrder = void 0;
const waba_cleison_oficial_balance_repair_1 = require("./waba-cleison-oficial-balance-repair");
const waba_disparos_order_shipments_1 = require("./waba-disparos-order-shipments");
const normalizeEmail = (value) => value.trim().toLowerCase();
/** Preços de pacote vendido (centavos), com e sem acréscimo Cleison. */
const CATALOG_PACK_VALUE_CENTS = new Set([
    20000, 32000, 34000, 35000, 57000, 85000, 93000, 99000, 128000, 150000, 160000, 200000, 232000,
    270000, 280000, 380000, 390000, 520000, 740000, 750000, 1080000, 1400000, 1650000,
]);
const isOperationalBalanceRepairOrder = (order) => String(order.asaasExternalReference ?? "").trim() === waba_cleison_oficial_balance_repair_1.CLEISON_OFICIAL_FORCE_REF ||
    order.grantCreatedByEmail === "system-balance-repair";
exports.isOperationalBalanceRepairOrder = isOperationalBalanceRepairOrder;
/** Pacote vendido (1000, 3000, 5000…), não restante 1849 nem grant 1016. */
const isCatalogSaleQuantity = (qty) => {
    const n = Math.max(0, Math.round(Number(qty ?? 0)));
    return n >= 1000 && n % 1000 === 0;
};
exports.isCatalogSaleQuantity = isCatalogSaleQuantity;
const paidAtMs = (order) => {
    const ms = Date.parse(String(order.paidAt ?? order.createdAt ?? ""));
    return Number.isFinite(ms) ? ms : 0;
};
const paidAtMinuteKey = (order) => {
    const ms = paidAtMs(order);
    if (!ms)
        return "";
    const date = new Date(ms);
    return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}T${date.getUTCHours()}:${date.getUTCMinutes()}`;
};
const hasAsaasPaymentId = (order) => String(order.asaasPaymentId ?? "").trim().length > 0;
/**
 * Quantidade contratada da compra. Recupera 5.000 quando o pedido gravou
 * 7.679 (= 5.000 + bônus) em purchasedShipmentCount. Não trata restante
 * 2.834 − 834 = 2.000 como pacote vendido.
 */
const resolveRealPurchasedShipmentCount = (order) => {
    const purchased = (0, waba_disparos_order_shipments_1.resolvePurchasedShipmentCount)(order);
    const total = Math.max(0, Math.round(Number(order.shipmentCount ?? 0)));
    const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    if ((0, exports.isCatalogSaleQuantity)(purchased))
        return purchased;
    if ((0, exports.isCatalogSaleQuantity)(total))
        return total;
    const recovered = [purchased - applied, total - applied].find(exports.isCatalogSaleQuantity) ?? 0;
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
exports.resolveRealPurchasedShipmentCount = resolveRealPurchasedShipmentCount;
const catalogQtyFromValueCents = (valueCents, apiKind) => {
    if (valueCents <= 0)
        return 0;
    if (apiKind === "alternativa") {
        if (valueCents === 20000)
            return 1000;
        if (valueCents === 57000)
            return 3000;
        if (valueCents === 85000)
            return 5000;
        if (valueCents === 128000)
            return 8000;
        if (valueCents === 150000)
            return 10000;
        if (valueCents === 280000)
            return 20000;
        if (valueCents === 390000)
            return 30000;
        return 0;
    }
    if (valueCents === 32000 || valueCents === 34000 || valueCents === 35000)
        return 1000;
    if (valueCents === 93000 || valueCents === 99000)
        return 3000;
    if (valueCents === 150000 || valueCents === 160000 || valueCents === 200000)
        return 5000;
    if (valueCents === 232000)
        return 8000;
    if (valueCents === 270000 || valueCents === 380000)
        return 10000;
    if (valueCents === 520000 || valueCents === 740000)
        return 20000;
    if (valueCents === 750000 || valueCents === 1080000)
        return 30000;
    return 0;
};
/**
 * Compras reais do assinante: pacotes pagos, sem freeze, sem grant, sem restante
 * e sem clones criados no mesmo minuto do force-balance.
 */
const listRealPaidPurchases = (orders, email) => {
    const normalized = normalizeEmail(email);
    if (!normalized)
        return [];
    const paid = orders
        .filter((order) => order.product === "waba-disparos" &&
        order.status === "paid" &&
        normalizeEmail(order.ownerEmail) === normalized &&
        String(order.paidAt ?? "").trim().length > 0)
        .sort((a, b) => paidAtMs(b) - paidAtMs(a));
    const freezeMinutes = new Set(paid.filter((order) => (0, exports.isOperationalBalanceRepairOrder)(order)).map(paidAtMinuteKey).filter(Boolean));
    const catalog = paid.filter((order) => {
        if (order.grantSource === "admin-bonus-envios")
            return false;
        if ((0, exports.isOperationalBalanceRepairOrder)(order))
            return false;
        const minute = paidAtMinuteKey(order);
        if (minute && freezeMinutes.has(minute))
            return false;
        return (0, exports.resolveRealPurchasedShipmentCount)(order) > 0;
    });
    const qtyHasAsaas = new Set();
    for (const order of catalog) {
        if (hasAsaasPaymentId(order)) {
            qtyHasAsaas.add((0, exports.resolveRealPurchasedShipmentCount)(order));
        }
    }
    const oldestFirst = [...catalog].sort((a, b) => paidAtMs(a) - paidAtMs(b));
    const seenPaymentIds = new Set();
    const unique = [];
    for (const order of oldestFirst) {
        const purchased = (0, exports.resolveRealPurchasedShipmentCount)(order);
        const paymentId = String(order.asaasPaymentId ?? "").trim();
        if (!paymentId && qtyHasAsaas.has(purchased))
            continue;
        if (paymentId) {
            if (seenPaymentIds.has(paymentId))
                continue;
            seenPaymentIds.add(paymentId);
        }
        unique.push(order);
    }
    return unique.sort((a, b) => paidAtMs(b) - paidAtMs(a));
};
exports.listRealPaidPurchases = listRealPaidPurchases;
const sumPurchasedShipments = (orders) => orders.reduce((sum, order) => sum + (0, exports.resolveRealPurchasedShipmentCount)(order), 0);
exports.sumPurchasedShipments = sumPurchasedShipments;
