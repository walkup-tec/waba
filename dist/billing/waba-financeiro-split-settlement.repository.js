"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaFinanceiroSplitSettlementRepository = exports.deriveSettlementPayoutStatus = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-financeiro-split-settlements.json";
const normalizePayoutStatus = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "processing" ||
        normalized === "paid" ||
        normalized === "failed" ||
        normalized === "skipped") {
        return normalized;
    }
    return "pending";
};
const normalizeSettlementPayoutStatus = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "processing" ||
        normalized === "partial" ||
        normalized === "paid" ||
        normalized === "failed") {
        return normalized;
    }
    return "pending";
};
const deriveSettlementPayoutStatus = (lines) => {
    const payable = lines.filter((line) => line.amountCents > 0 && line.lineKind !== "cet" && line.payoutStatus !== "skipped");
    if (!payable.length)
        return "paid";
    if (payable.every((line) => line.payoutStatus === "paid" || line.payoutStatus === "skipped")) {
        return "paid";
    }
    if (payable.some((line) => line.payoutStatus === "failed")) {
        return payable.some((line) => line.payoutStatus === "paid") ? "partial" : "failed";
    }
    if (payable.some((line) => line.payoutStatus === "processing"))
        return "processing";
    if (payable.some((line) => line.payoutStatus === "paid"))
        return "partial";
    return "pending";
};
exports.deriveSettlementPayoutStatus = deriveSettlementPayoutStatus;
const normalizeLineKind = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "supplier")
        return "supplier";
    if (normalized === "cet")
        return "cet";
    return "partner";
};
const normalizeLine = (line) => ({
    lineKind: normalizeLineKind(line.lineKind),
    participantId: String(line.participantId ?? ""),
    participantLabel: String(line.participantLabel ?? ""),
    participantEmail: String(line.participantEmail ?? ""),
    pixKey: String(line.pixKey ?? ""),
    sharePercent: Number(line.sharePercent ?? 0),
    amountCents: Math.max(0, Math.round(Number(line.amountCents ?? 0))),
    shipmentCount: line.shipmentCount != null ? Math.max(0, Math.round(Number(line.shipmentCount))) : undefined,
    costPerShipmentCents: line.costPerShipmentCents != null
        ? Math.max(0, Math.round(Number(line.costPerShipmentCents)))
        : undefined,
    payoutStatus: normalizePayoutStatus(line.payoutStatus),
    asaasTransferId: line.asaasTransferId ? String(line.asaasTransferId) : undefined,
    payoutExternalReference: line.payoutExternalReference
        ? String(line.payoutExternalReference)
        : undefined,
    transactionReceiptUrl: line.transactionReceiptUrl
        ? String(line.transactionReceiptUrl)
        : undefined,
    paidAt: line.paidAt ? String(line.paidAt) : undefined,
    failureReason: line.failureReason ? String(line.failureReason) : undefined,
});
const normalizeSettlement = (item) => {
    const lines = Array.isArray(item.lines) ? item.lines.map((line) => normalizeLine(line)) : [];
    const payoutStatus = item.payoutStatus != null
        ? normalizeSettlementPayoutStatus(item.payoutStatus)
        : (0, exports.deriveSettlementPayoutStatus)(lines);
    return {
        ...item,
        lines,
        payoutStatus,
        payoutCompletedAt: item.payoutCompletedAt ? String(item.payoutCompletedAt) : undefined,
    };
};
class WabaFinanceiroSplitSettlementRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return { version: 1, settlements: [] };
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.settlements)) {
                return { version: 1, settlements: [] };
            }
            return {
                version: 1,
                settlements: parsed.settlements.map((item) => normalizeSettlement({
                    ...item,
                    lines: Array.isArray(item.lines)
                        ? item.lines.map((line) => normalizeLine({
                            ...line,
                            lineKind: normalizeLineKind(line.lineKind),
                        }))
                        : [],
                })),
            };
        }
        catch {
            return { version: 1, settlements: [] };
        }
    }
    writeStore(store) {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(store, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
    }
    list(limit = 200) {
        const cap = Math.max(1, Math.min(500, Math.floor(limit)));
        return this.readStore()
            .settlements.slice()
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, cap);
    }
    getById(settlementId) {
        const normalized = String(settlementId ?? "").trim();
        if (!normalized)
            return null;
        return this.readStore().settlements.find((item) => item.id === normalized) ?? null;
    }
    getByOrderId(orderId) {
        const normalized = String(orderId ?? "").trim();
        if (!normalized)
            return null;
        return this.readStore().settlements.find((item) => item.orderId === normalized) ?? null;
    }
    create(settlement) {
        const store = this.readStore();
        const lines = settlement.lines.map((line) => normalizeLine({
            ...line,
            payoutStatus: line.payoutStatus ?? "pending",
        }));
        const record = normalizeSettlement({
            ...settlement,
            lines,
            payoutStatus: settlement.payoutStatus ?? (0, exports.deriveSettlementPayoutStatus)(lines),
            id: (0, node_crypto_1.randomUUID)(),
            createdAt: new Date().toISOString(),
        });
        store.settlements.push(record);
        this.writeStore(store);
        return record;
    }
    save(settlement) {
        const store = this.readStore();
        const index = store.settlements.findIndex((item) => item.id === settlement.id);
        if (index < 0) {
            throw new Error("Settlement não encontrado.");
        }
        const record = normalizeSettlement(settlement);
        store.settlements[index] = record;
        this.writeStore(store);
        return record;
    }
}
exports.WabaFinanceiroSplitSettlementRepository = WabaFinanceiroSplitSettlementRepository;
