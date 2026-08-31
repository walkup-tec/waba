"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaBillingOrderRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const ORDERS_FILE = (0, data_path_1.resolveDataFile)("waba-billing-orders.json");
const ensureStorage = () => {
    const folder = (0, node_path_1.dirname)(ORDERS_FILE);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(ORDERS_FILE)) {
        (0, node_fs_1.writeFileSync)(ORDERS_FILE, "[]", "utf-8");
    }
};
const loadOrders = () => {
    ensureStorage();
    try {
        const raw = (0, node_fs_1.readFileSync)(ORDERS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const saveOrders = (orders) => {
    ensureStorage();
    (0, node_fs_1.writeFileSync)(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
};
class WabaBillingOrderRepository {
    list() {
        return loadOrders();
    }
    getById(orderId) {
        const normalized = String(orderId ?? "").trim();
        if (!normalized)
            return null;
        return loadOrders().find((order) => order.id === normalized) ?? null;
    }
    getByAsaasPaymentId(paymentId) {
        const normalized = String(paymentId ?? "").trim();
        if (!normalized)
            return null;
        return loadOrders().find((order) => order.asaasPaymentId === normalized) ?? null;
    }
    getByAsaasExternalReference(externalReference) {
        const normalized = String(externalReference ?? "").trim();
        if (!normalized)
            return null;
        return loadOrders().find((order) => order.asaasExternalReference === normalized) ?? null;
    }
    create(order) {
        const orders = loadOrders();
        orders.push(order);
        saveOrders(orders);
        return order;
    }
    update(orderId, patch) {
        const orders = loadOrders();
        const index = orders.findIndex((order) => order.id === orderId);
        if (index === -1)
            return null;
        const next = {
            ...orders[index],
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        orders[index] = next;
        saveOrders(orders);
        return next;
    }
}
exports.WabaBillingOrderRepository = WabaBillingOrderRepository;
