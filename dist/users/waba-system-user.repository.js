"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaSystemUserRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
const FILE_NAME = "waba-system-users.json";
const emptyStore = () => ({ version: 1, users: [] });
class WabaSystemUserRepository {
    readStore() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE_NAME);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, node_fs_1.existsSync)(filePath))
            return emptyStore();
        try {
            const parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
            if (parsed?.version !== 1 || !Array.isArray(parsed.users))
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
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
    }
    list() {
        return this.readStore().users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
    }
    getById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        return this.readStore().users.find((item) => item.id === normalized) ?? null;
    }
    getByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return this.list().find((item) => item.email === normalized) ?? null;
    }
    getRoleByEmail(email) {
        return this.getByEmail(email)?.role ?? null;
    }
    create(user) {
        const store = this.readStore();
        if (store.users.some((item) => item.email === user.email)) {
            throw new Error("Já existe um usuário com este e-mail.");
        }
        store.users.push(user);
        this.writeStore(store);
        return user;
    }
    updateById(id, patch) {
        const store = this.readStore();
        const index = store.users.findIndex((item) => item.id === id);
        if (index < 0)
            return null;
        const current = store.users[index];
        const next = {
            ...current,
            ...patch,
            updatedAt: patch.updatedAt ?? new Date().toISOString(),
        };
        store.users[index] = next;
        this.writeStore(store);
        return next;
    }
    deleteById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return false;
        const store = this.readStore();
        const index = store.users.findIndex((item) => item.id === normalized);
        if (index < 0)
            return false;
        store.users.splice(index, 1);
        this.writeStore(store);
        return true;
    }
    replaceAll(users) {
        this.writeStore({ version: 1, users });
    }
}
exports.WabaSystemUserRepository = WabaSystemUserRepository;
