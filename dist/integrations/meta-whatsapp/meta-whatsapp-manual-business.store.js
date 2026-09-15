"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeManualBusinessId = normalizeManualBusinessId;
exports.listManualBusinesses = listManualBusinesses;
exports.listManualBusinessIds = listManualBusinessIds;
exports.addManualBusiness = addManualBusiness;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const FILE_NAME = "meta-whatsapp-manual-businesses.json";
function storePath() {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), FILE_NAME);
}
function emptyStore() {
    return { version: 1, byTenant: {} };
}
function readStore() {
    const file = storePath();
    if (!(0, node_fs_1.existsSync)(file))
        return emptyStore();
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        if (parsed?.version !== 1 || !parsed.byTenant || typeof parsed.byTenant !== "object") {
            return emptyStore();
        }
        return parsed;
    }
    catch {
        return emptyStore();
    }
}
function writeStore(store) {
    const file = storePath();
    (0, node_fs_1.mkdirSync)(node_path_1.default.dirname(file), { recursive: true });
    (0, node_fs_1.writeFileSync)(file, JSON.stringify(store), "utf8");
}
function normalizeManualBusinessId(value) {
    return String(value || "").replace(/\D/g, "");
}
function listManualBusinesses(tenantId) {
    const key = String(tenantId || "").trim();
    if (!key)
        return [];
    const rows = readStore().byTenant[key] || [];
    return rows
        .map((row) => ({
        id: normalizeManualBusinessId(row.id),
        name: String(row.name || "").trim(),
    }))
        .filter((row) => row.id.length >= 6);
}
function listManualBusinessIds(tenantId) {
    return listManualBusinesses(tenantId).map((row) => row.id);
}
function addManualBusiness(tenantId, businessId, name = "") {
    const key = String(tenantId || "").trim();
    const id = normalizeManualBusinessId(businessId);
    const label = String(name || "").trim();
    if (!key || id.length < 6) {
        throw new Error("ID do portfólio inválido.");
    }
    const store = readStore();
    const current = store.byTenant[key] || [];
    const next = { id, name: label };
    const idx = current.findIndex((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(row.id, id));
    if (idx >= 0) {
        current[idx] = { id, name: label || current[idx].name };
    }
    else {
        current.push(next);
    }
    store.byTenant[key] = current;
    writeStore(store);
    return current[idx >= 0 ? idx : current.length - 1];
}
