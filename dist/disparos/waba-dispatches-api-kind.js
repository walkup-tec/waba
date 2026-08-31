"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIntakeApiKindFromIntake = exports.resolveOrderApiKind = exports.resolveSubscriberDispatchesApiKindFromOrders = exports.resolveSubscriberDispatchesApiKindFromOrdersAt = exports.normalizeDispatchesApiKind = exports.WABA_DISPATCHES_API_LABELS = void 0;
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
exports.WABA_DISPATCHES_API_LABELS = {
    oficial: "API Oficial",
    alternativa: "API Alternativa",
};
const normalizeDispatchesApiKind = (value) => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (raw === "oficial" || raw === "alternativa")
        return raw;
    return null;
};
exports.normalizeDispatchesApiKind = normalizeDispatchesApiKind;
const listPaidDisparosOrdersForEmail = (ownerEmail, orderRepository) => {
    const normalized = ownerEmail.trim().toLowerCase();
    return orderRepository
        .list()
        .filter((order) => order.product === "waba-disparos" &&
        order.status === "paid" &&
        order.ownerEmail.trim().toLowerCase() === normalized &&
        String(order.paidAt ?? "").trim().length > 0)
        .sort((a, b) => new Date(b.paidAt || b.updatedAt).getTime() - new Date(a.paidAt || a.updatedAt).getTime());
};
/** Plano ativo no momento de referência (ex.: criação da campanha). */
const resolveSubscriberDispatchesApiKindFromOrdersAt = (ownerEmail, atIso, orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) => {
    const atMs = new Date(atIso).getTime();
    const paidOrders = listPaidDisparosOrdersForEmail(ownerEmail, orderRepository).filter((order) => {
        const paidMs = new Date(order.paidAt || order.updatedAt).getTime();
        return !Number.isNaN(paidMs) && paidMs <= atMs;
    });
    const latest = paidOrders[0];
    return latest?.apiKind === "alternativa" ? "alternativa" : "oficial";
};
exports.resolveSubscriberDispatchesApiKindFromOrdersAt = resolveSubscriberDispatchesApiKindFromOrdersAt;
const resolveSubscriberDispatchesApiKindFromOrders = (ownerEmail, orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) => {
    return (0, exports.resolveSubscriberDispatchesApiKindFromOrdersAt)(ownerEmail, new Date().toISOString(), orderRepository);
};
exports.resolveSubscriberDispatchesApiKindFromOrders = resolveSubscriberDispatchesApiKindFromOrders;
const resolveOrderApiKind = (order) => {
    return order.apiKind === "alternativa" ? "alternativa" : "oficial";
};
exports.resolveOrderApiKind = resolveOrderApiKind;
const resolveIntakeApiKindFromIntake = (intake) => {
    if (intake.apiKind === "oficial" || intake.apiKind === "alternativa") {
        return intake.apiKind;
    }
    return (0, exports.resolveSubscriberDispatchesApiKindFromOrdersAt)(intake.ownerEmail, intake.createdAt);
};
exports.resolveIntakeApiKindFromIntake = resolveIntakeApiKindFromIntake;
