"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPriorRemainderBalanceOrder = exports.resolvePurchasedShipmentCount = exports.resolveActiveOrderShipmentCount = exports.isOrderCreditsActive = exports.resolveOrderShipmentCount = void 0;
const resolveOrderShipmentCount = (order) => {
    const explicit = Math.round(Number(order.shipmentCount ?? 0));
    if (Number.isFinite(explicit) && explicit > 0)
        return explicit;
    const valueCents = Math.round(Number(order.valueCents ?? 0));
    if (valueCents <= 0)
        return 0;
    return Math.max(1, Math.round(valueCents / 30));
};
exports.resolveOrderShipmentCount = resolveOrderShipmentCount;
/** Pedidos de grant desativados ou com validade expirada não entram no Disponível. */
const isOrderCreditsActive = (order, nowMs = Date.now()) => {
    if (order.grantSource === "admin-bonus-envios" && order.grantActive === false) {
        return false;
    }
    const until = String(order.creditsValidUntil ?? "").trim();
    if (!until)
        return true;
    const untilMs = Date.parse(until);
    if (!Number.isFinite(untilMs))
        return true;
    return nowMs <= untilMs;
};
exports.isOrderCreditsActive = isOrderCreditsActive;
const resolveActiveOrderShipmentCount = (order, nowMs = Date.now()) => {
    if (!(0, exports.isOrderCreditsActive)(order, nowMs))
        return 0;
    return (0, exports.resolveOrderShipmentCount)(order);
};
exports.resolveActiveOrderShipmentCount = resolveActiveOrderShipmentCount;
/** Envios comprados, sem a bonificação já liquidada neste pedido. */
const resolvePurchasedShipmentCount = (order) => {
    const explicit = Math.round(Number(order.purchasedShipmentCount ?? 0));
    if (Number.isFinite(explicit) && explicit > 0)
        return explicit;
    const total = (0, exports.resolveOrderShipmentCount)(order);
    const applied = Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0)));
    return Math.max(0, total - applied);
};
exports.resolvePurchasedShipmentCount = resolvePurchasedShipmentCount;
/**
 * Restante de um pacote antigo: compra menor ao lado de outra compra paga maior
 * do mesmo plano. Não é PIX novo — bônus de campanha não liquida nesse pedido.
 */
const isPriorRemainderBalanceOrder = (order, purchases) => {
    const purchased = (0, exports.resolvePurchasedShipmentCount)(order);
    if (purchased <= 0)
        return false;
    return purchases.some((other) => {
        if (other.id === order.id)
            return false;
        if (other.grantSource === "admin-bonus-envios")
            return false;
        return (0, exports.resolvePurchasedShipmentCount)(other) > purchased;
    });
};
exports.isPriorRemainderBalanceOrder = isPriorRemainderBalanceOrder;
