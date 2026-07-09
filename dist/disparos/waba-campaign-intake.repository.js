"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCampaignIntakeRepository = exports.resolveCampaignIntakeStorageDir = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const STORE_FILE = (0, data_path_1.resolveDataFile)("waba-campaign-intakes.json");
const resolveCampaignIntakeStorageDir = (intakeId) => {
    const base = (0, data_path_1.resolveDataDir)();
    const dir = `${base}/campaign-intakes/${intakeId}`;
    if (!(0, node_fs_1.existsSync)(dir))
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    return dir;
};
exports.resolveCampaignIntakeStorageDir = resolveCampaignIntakeStorageDir;
const emptyStore = () => ({ version: 1, intakes: [] });
const ensureStore = () => {
    const folder = (0, node_path_1.dirname)(STORE_FILE);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(STORE_FILE)) {
        (0, node_fs_1.writeFileSync)(STORE_FILE, JSON.stringify(emptyStore(), null, 2), "utf-8");
    }
};
const readStore = () => {
    ensureStore();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(STORE_FILE, "utf-8"));
        if (parsed?.version !== 1 || !Array.isArray(parsed.intakes))
            return emptyStore();
        return parsed;
    }
    catch {
        return emptyStore();
    }
};
const writeStore = (store) => {
    ensureStore();
    const payload = JSON.stringify(store, null, 2);
    const tmp = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    (0, node_fs_1.writeFileSync)(tmp, payload, "utf-8");
    (0, node_fs_1.renameSync)(tmp, STORE_FILE);
};
class WabaCampaignIntakeRepository {
    create(intake) {
        const store = readStore();
        store.intakes.unshift(intake);
        writeStore(store);
        return intake;
    }
    listAll() {
        return readStore().intakes;
    }
    listByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return readStore()
            .intakes.filter((item) => item.ownerEmail === normalized)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    getById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        return readStore().intakes.find((item) => item.id === normalized) ?? null;
    }
    findByOwnerAndClientRequestId(ownerEmail, clientRequestId) {
        const email = ownerEmail.trim().toLowerCase();
        const requestId = String(clientRequestId ?? "").trim();
        if (!email || !requestId)
            return null;
        return (readStore().intakes.find((item) => item.ownerEmail === email &&
            String(item.clientRequestId || "").trim() === requestId) ?? null);
    }
    updateById(id, patch) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        const store = readStore();
        const index = store.intakes.findIndex((item) => item.id === normalized);
        if (index < 0)
            return null;
        store.intakes[index] = { ...store.intakes[index], ...patch };
        writeStore(store);
        return store.intakes[index];
    }
}
exports.WabaCampaignIntakeRepository = WabaCampaignIntakeRepository;
