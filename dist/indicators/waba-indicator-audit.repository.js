"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaIndicatorAuditRepository = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-indicator-audit.json";
const MAX_EVENTS = 5000;
const emptyStore = () => ({ version: 1, events: [] });
class WabaIndicatorAuditRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.events))
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
    append(input) {
        const store = this.readStore();
        store.events.push({
            id: (0, node_crypto_1.randomUUID)(),
            actorUserId: String(input.actorUserId ?? "").trim(),
            actorEmail: String(input.actorEmail ?? "").trim().toLowerCase(),
            action: String(input.action ?? "").trim(),
            entityType: String(input.entityType ?? "").trim(),
            entityId: String(input.entityId ?? "").trim(),
            previousValue: input.previousValue ?? null,
            nextValue: input.nextValue ?? null,
            createdAt: input.createdAt || new Date().toISOString(),
        });
        if (store.events.length > MAX_EVENTS) {
            store.events = store.events.slice(store.events.length - MAX_EVENTS);
        }
        this.writeStore(store);
    }
    listByEntity(entityType, entityId, limit = 50) {
        const type = String(entityType ?? "").trim();
        const id = String(entityId ?? "").trim();
        return this.readStore()
            .events.filter((item) => item.entityType === type && item.entityId === id)
            .slice(-Math.max(1, limit))
            .reverse();
    }
}
exports.WabaIndicatorAuditRepository = WabaIndicatorAuditRepository;
