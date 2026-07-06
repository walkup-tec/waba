"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaDisparosBonusRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const waba_dispatches_api_kind_1 = require("../disparos/waba-dispatches-api-kind");
const waba_billing_order_repository_1 = require("./waba-billing-order.repository");
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-disparos-bonus-balances.json";
const normalizeEmail = (value) => value.trim().toLowerCase();
const emptyStore = () => ({ version: 2, entries: [] });
const resolveFilePath = () => (0, data_path_1.resolveDataFile)(FILE_NAME);
const ensureStorage = () => {
    const filePath = resolveFilePath();
    const folder = (0, node_path_1.dirname)(filePath);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(filePath)) {
        (0, node_fs_1.writeFileSync)(filePath, JSON.stringify(emptyStore(), null, 2), "utf-8");
    }
};
const normalizeGrantApiKind = (value) => {
    return (0, waba_dispatches_api_kind_1.normalizeDispatchesApiKind)(value) ?? "oficial";
};
const migrateLegacyEntry = (legacy) => {
    const email = normalizeEmail(legacy.email);
    const now = String(legacy.updatedAt ?? new Date().toISOString());
    const grants = Array.isArray(legacy.grants)
        ? legacy.grants.map((grant) => ({
            campaignId: String(grant.campaignId ?? "").trim(),
            shipments: Math.max(0, Math.round(Number(grant.shipments ?? 0))),
            grantedAt: String(grant.grantedAt ?? now),
            apiKind: normalizeGrantApiKind(grant.apiKind),
        }))
        : [];
    return { email, grants, updatedAt: now };
};
const readStore = () => {
    ensureStorage();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(resolveFilePath(), "utf-8"));
        if (parsed?.version === 2 && Array.isArray(parsed.entries)) {
            return { version: 2, entries: parsed.entries };
        }
        if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
            const migrated = {
                version: 2,
                entries: parsed.entries.map(migrateLegacyEntry),
            };
            writeStore(migrated);
            return migrated;
        }
        return emptyStore();
    }
    catch {
        return emptyStore();
    }
};
const writeStore = (store) => {
    ensureStorage();
    (0, node_fs_1.writeFileSync)(resolveFilePath(), JSON.stringify(store, null, 2), "utf-8");
};
const sumAppliedBonusFromOrders = (email, apiKind, orderRepository) => {
    const normalized = normalizeEmail(email);
    return orderRepository
        .list()
        .filter((order) => order.product === "waba-disparos" &&
        order.status === "paid" &&
        normalizeEmail(order.ownerEmail) === normalized &&
        (0, waba_dispatches_api_kind_1.resolveOrderApiKind)(order) === apiKind)
        .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))), 0);
};
class WabaDisparosBonusRepository {
    constructor(orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository()) {
        this.orderRepository = orderRepository;
    }
    getEntry(email) {
        const normalized = normalizeEmail(email);
        if (!normalized)
            return null;
        return readStore().entries.find((item) => item.email === normalized) ?? null;
    }
    getPendingShipments(email, apiKind) {
        const entry = this.getEntry(email);
        if (!entry)
            return 0;
        const granted = entry.grants
            .filter((grant) => grant.apiKind === apiKind)
            .reduce((sum, grant) => sum + Math.max(0, Math.round(Number(grant.shipments ?? 0))), 0);
        const applied = sumAppliedBonusFromOrders(email, apiKind, this.orderRepository);
        return Math.max(0, granted - applied);
    }
    getPendingShipmentsTotal(email) {
        return (this.getPendingShipments(email, "oficial") + this.getPendingShipments(email, "alternativa"));
    }
    getEarliestGrantAt(email, apiKind) {
        const entry = this.getEntry(email);
        if (!entry)
            return "";
        const grantDates = entry.grants
            .filter((grant) => grant.apiKind === apiKind)
            .map((grant) => String(grant.grantedAt ?? "").trim())
            .filter((value) => value.length > 0)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        return grantDates[0] ?? "";
    }
    grantFromCampaign(email, campaignId, shipments, apiKind) {
        const normalized = normalizeEmail(email);
        const campaignKey = String(campaignId ?? "").trim();
        const amount = Math.max(0, Math.round(Number(shipments)));
        if (!normalized || !campaignKey || amount <= 0) {
            return this.getPendingShipments(normalized, apiKind);
        }
        const store = readStore();
        const now = new Date().toISOString();
        const index = store.entries.findIndex((item) => item.email === normalized);
        const current = index >= 0
            ? store.entries[index]
            : { email: normalized, grants: [], updatedAt: now };
        if (current.grants.some((grant) => grant.campaignId === campaignKey)) {
            return this.getPendingShipments(normalized, apiKind);
        }
        const next = {
            ...current,
            grants: [
                ...current.grants,
                { campaignId: campaignKey, shipments: amount, grantedAt: now, apiKind },
            ],
            updatedAt: now,
        };
        if (index >= 0) {
            store.entries[index] = next;
        }
        else {
            store.entries.push(next);
        }
        writeStore(store);
        return this.getPendingShipments(normalized, apiKind);
    }
    clearPendingShipments(email, apiKind) {
        return this.getPendingShipments(email, apiKind);
    }
    listGrantHistory(email, limit = 20) {
        const entry = this.getEntry(email);
        if (!entry)
            return [];
        const cap = Math.max(1, Math.min(50, Math.floor(limit)));
        const appliedBudget = {
            oficial: sumAppliedBonusFromOrders(email, "oficial", this.orderRepository),
            alternativa: sumAppliedBonusFromOrders(email, "alternativa", this.orderRepository),
        };
        const grantsOldestFirst = [...entry.grants].sort((a, b) => new Date(a.grantedAt).getTime() - new Date(b.grantedAt).getTime());
        const statusByCampaignId = new Map();
        for (const kind of ["oficial", "alternativa"]) {
            let remainingApplied = appliedBudget[kind];
            for (const grant of grantsOldestFirst.filter((item) => item.apiKind === kind)) {
                const amount = Math.max(0, Math.round(Number(grant.shipments ?? 0)));
                if (remainingApplied >= amount && amount > 0) {
                    statusByCampaignId.set(grant.campaignId, "applied");
                    remainingApplied -= amount;
                }
                else {
                    statusByCampaignId.set(grant.campaignId, "pending");
                }
            }
        }
        return [...entry.grants]
            .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
            .slice(0, cap)
            .map((grant) => ({
            campaignId: grant.campaignId,
            shipments: Math.max(0, Math.round(Number(grant.shipments ?? 0))),
            grantedAt: String(grant.grantedAt ?? ""),
            apiKind: grant.apiKind,
            status: statusByCampaignId.get(grant.campaignId) ?? "pending",
        }));
    }
}
exports.WabaDisparosBonusRepository = WabaDisparosBonusRepository;
