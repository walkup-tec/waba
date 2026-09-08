"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaIndicatorCommissionRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const waba_money_cents_1 = require("../billing/waba-money-cents");
const FILE_NAME = "waba-indicator-commissions.json";
const emptyStore = () => ({ version: 1, commissions: [] });
const STATUSES = [
    "pending",
    "processing",
    "paid",
    "failed",
    "canceled",
];
const normalizeStatus = (value) => {
    const raw = String(value ?? "").trim().toLowerCase();
    return STATUSES.includes(raw)
        ? raw
        : "pending";
};
class WabaIndicatorCommissionRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.commissions))
                return emptyStore();
            return parsed;
        }
        catch {
            return emptyStore();
        }
    }
    writeStore(store) {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(store, null, 2), "utf8");
        (0, node_fs_1.renameSync)(tmp, filePath);
    }
    list() {
        return this.readStore().commissions.slice();
    }
    getById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        return this.list().find((item) => item.id === normalized) ?? null;
    }
    getByOrderId(orderId) {
        const normalized = String(orderId ?? "").trim();
        if (!normalized)
            return null;
        return this.list().find((item) => item.orderId === normalized) ?? null;
    }
    listByIndicatorUserId(indicatorUserId) {
        const normalized = String(indicatorUserId ?? "").trim();
        if (!normalized)
            return [];
        return this.list().filter((item) => item.indicatorUserId === normalized);
    }
    createIfAbsent(commission) {
        const store = this.readStore();
        const existing = store.commissions.find((item) => item.orderId === commission.orderId);
        if (existing)
            return { commission: existing, created: false };
        store.commissions.push({
            ...commission,
            quantity: Math.max(0, Math.round(Number(commission.quantity ?? 0))),
            baseUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.baseUnitPriceCents),
            spreadUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.spreadUnitPriceCents),
            customerUnitPriceCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.customerUnitPriceCents),
            baseAmountCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.baseAmountCents),
            commissionAmountCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.commissionAmountCents),
            totalAmountCents: (0, waba_money_cents_1.toNonNegativeCents)(commission.totalAmountCents),
            status: normalizeStatus(commission.status),
        });
        this.writeStore(store);
        return { commission, created: true };
    }
    updateById(id, patch) {
        const store = this.readStore();
        const index = store.commissions.findIndex((item) => item.id === String(id ?? "").trim());
        if (index < 0)
            return null;
        const current = store.commissions[index];
        const next = {
            ...current,
            ...patch,
            status: normalizeStatus(patch.status ?? current.status),
            updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
        };
        store.commissions[index] = next;
        this.writeStore(store);
        return next;
    }
}
exports.WabaIndicatorCommissionRepository = WabaIndicatorCommissionRepository;
