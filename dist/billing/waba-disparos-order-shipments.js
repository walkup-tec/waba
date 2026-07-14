"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveActiveOrderShipmentCount = exports.isOrderCreditsActive = exports.resolveOrderShipmentCount = void 0;
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
/** Pedidos de grant com validade expirada não entram no saldo Disponível. */
const isOrderCreditsActive = (order, nowMs = Date.now()) => {
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
