"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaSubscriberRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-subscribers.json";
const emptyStore = () => ({ version: 1, subscribers: [] });
class WabaSubscriberRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const raw = (0, node_fs_1.readFileSync)(filePath, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 || !Array.isArray(parsed.subscribers))
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
        return this.readStore().subscribers;
    }
    getByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return this.list().find((item) => item.email === normalized) ?? null;
    }
    getById(id) {
        return this.list().find((item) => item.id === id) ?? null;
    }
    create(subscriber) {
        const store = this.readStore();
        if (store.subscribers.some((item) => item.email === subscriber.email)) {
            throw new Error("Já existe uma conta com este e-mail.");
        }
        store.subscribers.push(subscriber);
        this.writeStore(store);
        return subscriber;
    }
    update(id, patch) {
        const normalizedId = String(id ?? "").trim();
        if (!normalizedId)
            throw new Error("Assinante inválido.");
        const store = this.readStore();
        const index = store.subscribers.findIndex((item) => item.id === normalizedId);
        if (index < 0)
            throw new Error("Assinante não encontrado.");
        const current = store.subscribers[index];
        const nextEmail = String(patch.email ?? current.email)
            .trim()
            .toLowerCase();
        if (nextEmail !== current.email &&
            store.subscribers.some((item) => item.email === nextEmail && item.id !== normalizedId)) {
            throw new Error("Já existe uma conta com este e-mail.");
        }
        const updated = {
            ...current,
            ...patch,
            id: current.id,
            email: nextEmail,
            createdAt: current.createdAt,
            updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
        };
        store.subscribers[index] = updated;
        this.writeStore(store);
        return updated;
    }
}
exports.WabaSubscriberRepository = WabaSubscriberRepository;
