"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdsPowerRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const FILE = "waba-adspower-profiles.json";
const emptyStore = () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    profiles: [],
});
class WabaAdsPowerRepository {
    read() {
        const filePath = (0, data_path_1.resolveDataFile)(FILE);
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
    write(store) {
        const filePath = (0, data_path_1.resolveDataFile)(FILE);
        const dir = node_path_1.default.dirname(filePath);
        if (!(0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const payload = { ...store, updatedAt: new Date().toISOString() };
        const tmp = `${filePath}.tmp`;
        (0, node_fs_1.writeFileSync)(tmp, JSON.stringify(payload, null, 2), "utf8");
        (0, node_fs_1.writeFileSync)(filePath, (0, node_fs_1.readFileSync)(tmp));
        return payload;
    }
    list() {
        return this.read()
            .profiles.slice()
            .sort((a, b) => String(a.name || a.userId).localeCompare(String(b.name || b.userId), "pt-BR"));
    }
    getByUserId(userId) {
        const id = String(userId || "").trim();
        if (!id)
            return null;
        return this.read().profiles.find((row) => row.userId === id) ?? null;
    }
    upsertMany(rows) {
        const store = this.read();
        const byId = new Map(store.profiles.map((row) => [row.userId, row]));
        for (const row of rows) {
            const prev = byId.get(row.userId);
            byId.set(row.userId, prev ? { ...prev, ...row, userId: row.userId } : row);
        }
        return this.write({ version: 1, updatedAt: "", profiles: [...byId.values()] }).profiles;
    }
    save(row) {
        this.upsertMany([row]);
        return this.getByUserId(row.userId) || row;
    }
    replaceAll(rows) {
        return this.write({ version: 1, updatedAt: "", profiles: rows }).profiles;
    }
}
exports.WabaAdsPowerRepository = WabaAdsPowerRepository;
