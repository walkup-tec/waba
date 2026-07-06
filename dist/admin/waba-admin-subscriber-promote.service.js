"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminSubscriberPromoteService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const data_path_1 = require("../data-path");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const readJson = (filePath, fallback) => {
    if (!(0, node_fs_1.existsSync)(filePath))
        return fallback;
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
    }
    catch {
        return fallback;
    }
};
const writeJsonAtomic = (filePath, data) => {
    const dir = node_path_1.default.dirname(filePath);
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(data, null, 2), "utf8");
    (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
};
class WabaAdminSubscriberPromoteService {
    constructor(subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository()) {
        this.subscriberRepository = subscriberRepository;
    }
    promoteFromV02Bundle(bundle) {
        const email = normalizeEmail(bundle.email);
        if (!email.includes("@"))
            throw new Error("E-mail inválido no bundle.");
        const subscriber = bundle.subscriber;
        if (!subscriber?.passwordHash || normalizeEmail(subscriber.email) !== email) {
            throw new Error("Bundle de assinante inválido.");
        }
        const summary = {
            email,
            subscriber: "created",
            billingOrdersAdded: 0,
            creditUsage: false,
            instanceOwners: 0,
        };
        const existing = this.subscriberRepository.getByEmail(email);
        const subscribersPath = (0, data_path_1.resolveDataFile)("waba-subscribers.json");
        const store = readJson(subscribersPath, {
            version: 1,
            subscribers: [],
        });
        if (!Array.isArray(store.subscribers))
            store.subscribers = [];
        const payload = {
            ...subscriber,
            email,
            phone: String(subscriber.phone || subscriber.whatsapp || "").trim(),
            updatedAt: new Date().toISOString(),
        };
        const idx = store.subscribers.findIndex((row) => normalizeEmail(row.email) === email);
        if (idx >= 0) {
            store.subscribers[idx] = { ...store.subscribers[idx], ...payload, id: store.subscribers[idx].id };
            summary.subscriber = "updated";
        }
        else {
            store.subscribers.push(payload);
            summary.subscriber = "created";
        }
        writeJsonAtomic(subscribersPath, store);
        const ordersPath = (0, data_path_1.resolveDataFile)("waba-billing-orders.json");
        const orders = readJson(ordersPath, []);
        const orderList = Array.isArray(orders) ? orders : [];
        const knownIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
        for (const order of bundle.billingOrders || []) {
            const id = String(order?.id || "").trim();
            if (!id || knownIds.has(id))
                continue;
            if (normalizeEmail(String(order?.ownerEmail || "")) !== email)
                continue;
            orderList.unshift(order);
            knownIds.add(id);
            summary.billingOrdersAdded += 1;
        }
        writeJsonAtomic(ordersPath, orderList);
        if (bundle.creditUsage) {
            const usagePath = (0, data_path_1.resolveDataFile)("waba-disparos-credit-usage.json");
            const usageStore = readJson(usagePath, { version: 2, entries: [] });
            if (!Array.isArray(usageStore.entries))
                usageStore.entries = [];
            const entry = {
                email,
                consumedOficial: Math.max(0, Math.round(Number(bundle.creditUsage.consumedOficial ?? 0))),
                consumedAlternativa: Math.max(0, Math.round(Number(bundle.creditUsage.consumedAlternativa ?? 0))),
                updatedAt: String(bundle.creditUsage.updatedAt || new Date().toISOString()),
            };
            const usageIdx = usageStore.entries.findIndex((row) => normalizeEmail(String(row?.email || "")) === email);
            if (usageIdx >= 0)
                usageStore.entries[usageIdx] = entry;
            else
                usageStore.entries.push(entry);
            writeJsonAtomic(usagePath, usageStore);
            summary.creditUsage = true;
        }
        const ownersPath = (0, data_path_1.resolveDataFile)("instance-owners.json");
        const ownersStore = readJson(ownersPath, { instances: {} });
        if (!ownersStore.instances || typeof ownersStore.instances !== "object") {
            ownersStore.instances = {};
        }
        const now = new Date().toISOString();
        for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
            const key = String(name || "").trim();
            if (!key)
                continue;
            ownersStore.instances[key] = {
                ownerEmail: email,
                createdAt: String(meta?.createdAt || now),
                ...(meta?.syncedFromWalkupProdAt
                    ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
                    : { promotedFromV02At: now }),
            };
            summary.instanceOwners += 1;
        }
        if (summary.instanceOwners > 0)
            writeJsonAtomic(ownersPath, ownersStore);
        return {
            ok: true,
            ...summary,
            hadExistingSubscriber: Boolean(existing),
        };
    }
}
exports.WabaAdminSubscriberPromoteService = WabaAdminSubscriberPromoteService;
