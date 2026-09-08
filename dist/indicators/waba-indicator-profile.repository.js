"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaIndicatorProfileRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const waba_money_cents_1 = require("../billing/waba-money-cents");
const FILE_NAME = "waba-indicator-profiles.json";
const emptyStore = () => ({ version: 1, profiles: [] });
const normalizeStatus = (value) => String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
class WabaIndicatorProfileRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.profiles))
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
        return this.readStore().profiles.slice();
    }
    getById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        return this.list().find((item) => item.id === normalized) ?? null;
    }
    getByUserId(userId) {
        const normalized = String(userId ?? "").trim();
        if (!normalized)
            return null;
        return this.list().find((item) => item.userId === normalized) ?? null;
    }
    create(profile) {
        const store = this.readStore();
        if (store.profiles.some((item) => item.userId === profile.userId)) {
            throw new Error("Já existe um perfil de indicador para este usuário.");
        }
        store.profiles.push({
            ...profile,
            spreadCentsPerSend: (0, waba_money_cents_1.toNonNegativeCents)(profile.spreadCentsPerSend),
            status: normalizeStatus(profile.status),
        });
        this.writeStore(store);
        return profile;
    }
    updateByUserId(userId, patch) {
        const store = this.readStore();
        const index = store.profiles.findIndex((item) => item.userId === String(userId ?? "").trim());
        if (index < 0)
            return null;
        const current = store.profiles[index];
        const next = {
            ...current,
            ...patch,
            spreadCentsPerSend: (0, waba_money_cents_1.toNonNegativeCents)(patch.spreadCentsPerSend ?? current.spreadCentsPerSend),
            status: normalizeStatus(patch.status ?? current.status),
            updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
        };
        store.profiles[index] = next;
        this.writeStore(store);
        return next;
    }
}
exports.WabaIndicatorProfileRepository = WabaIndicatorProfileRepository;
