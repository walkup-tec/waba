"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHiddenBusinessIds = listHiddenBusinessIds;
exports.isHiddenBusiness = isHiddenBusiness;
exports.hideBusiness = hideBusiness;
exports.unhideBusiness = unhideBusiness;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const meta_whatsapp_manual_business_store_1 = require("./meta-whatsapp-manual-business.store");
const FILE_NAME = "meta-whatsapp-hidden-businesses.json";
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
function normalizeHiddenIds(rows) {
    if (!Array.isArray(rows))
        return [];
    const seen = new Set();
    const ids = [];
    for (const row of rows) {
        const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(String(row || ""));
        if (id.length < 6 || seen.has(id))
            continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}
function listHiddenBusinessIds(tenantId) {
    const key = String(tenantId || "").trim();
    if (!key)
        return [];
    return normalizeHiddenIds(readStore().byTenant[key]);
}
function isHiddenBusiness(tenantId, businessId) {
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    if (id.length < 6)
        return false;
    return listHiddenBusinessIds(tenantId).some((hidden) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(hidden, id));
}
function hideBusiness(tenantId, businessId) {
    const key = String(tenantId || "").trim();
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    if (!key || id.length < 6) {
        throw new Error("ID do portfólio inválido.");
    }
    const store = readStore();
    const current = normalizeHiddenIds(store.byTenant[key]);
    if (!current.some((hidden) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(hidden, id))) {
        current.push(id);
    }
    store.byTenant[key] = current;
    writeStore(store);
    return id;
}
function unhideBusiness(tenantId, businessId) {
    const key = String(tenantId || "").trim();
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    if (!key || id.length < 6)
        return;
    const store = readStore();
    const current = normalizeHiddenIds(store.byTenant[key]);
    const next = current.filter((hidden) => !(0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(hidden, id));
    if (next.length === current.length)
        return;
    if (next.length)
        store.byTenant[key] = next;
    else
        delete store.byTenant[key];
    writeStore(store);
}
