"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminMasterMenuBadgesRepository = exports.MASTER_MENU_BADGE_KEYS = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../data-path");
exports.MASTER_MENU_BADGE_KEYS = [
    "admin-assinantes",
    "admin-campanhas",
    "admin-usuarios",
    "admin-financeiro",
    "admin-chamados",
];
const FILE_NAME = "waba-master-menu-seen.json";
const emptyStore = () => ({ version: 1, masters: {} });
const normalizeEmail = (value) => value.trim().toLowerCase();
class WabaAdminMasterMenuBadgesRepository {
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
            if (parsed?.version !== 1 || typeof parsed.masters !== "object" || !parsed.masters) {
                return emptyStore();
            }
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
    getSeenAt(masterEmail, menuKey) {
        const email = normalizeEmail(masterEmail);
        if (!email)
            return null;
        const value = this.readStore().masters[email]?.[menuKey];
        return typeof value === "string" && value.trim() ? value.trim() : null;
    }
    getSeenMap(masterEmail) {
        const email = normalizeEmail(masterEmail);
        if (!email)
            return {};
        return { ...(this.readStore().masters[email] ?? {}) };
    }
    markSeen(masterEmail, menuKey, seenAt) {
        const email = normalizeEmail(masterEmail);
        if (!email)
            return;
        const store = this.readStore();
        const bucket = { ...(store.masters[email] ?? {}) };
        bucket[menuKey] = seenAt;
        store.masters[email] = bucket;
        this.writeStore(store);
    }
}
exports.WabaAdminMasterMenuBadgesRepository = WabaAdminMasterMenuBadgesRepository;
