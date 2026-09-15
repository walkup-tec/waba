"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHiddenBusinesses = listHiddenBusinesses;
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
function normalizeHiddenRows(rows) {
    if (!Array.isArray(rows))
        return [];
    const seen = new Set();
    const out = [];
    for (const row of rows) {
        const raw = row && typeof row === "object" ? row : { id: String(row || ""), name: "" };
        const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(String(raw.id || ""));
        if (id.length < 6 || seen.has(id))
            continue;
        seen.add(id);
        out.push({ id, name: String(raw.name || "").trim() });
    }
    return out;
}
function listHiddenBusinesses(tenantId) {
    const key = String(tenantId || "").trim();
    if (!key)
        return [];
    return normalizeHiddenRows(readStore().byTenant[key]);
}
function listHiddenBusinessIds(tenantId) {
    return listHiddenBusinesses(tenantId).map((row) => row.id);
}
function isHiddenBusiness(tenantId, businessId) {
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    if (id.length < 6)
        return false;
    return listHiddenBusinessIds(tenantId).some((hidden) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(hidden, id));
}
function hideBusiness(tenantId, businessId, name = "") {
    const key = String(tenantId || "").trim();
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    const label = String(name || "").trim();
    if (!key || id.length < 6) {
        throw new Error("ID do portfólio inválido.");
    }
    const store = readStore();
    const current = normalizeHiddenRows(store.byTenant[key]);
    const idx = current.findIndex((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(row.id, id));
    if (idx >= 0) {
        current[idx] = { id, name: label || current[idx].name };
    }
    else {
        current.push({ id, name: label });
    }
    store.byTenant[key] = current;
    writeStore(store);
    return current[idx >= 0 ? idx : current.length - 1];
}
function unhideBusiness(tenantId, businessId) {
    const key = String(tenantId || "").trim();
    const id = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(businessId);
    if (!key || id.length < 6)
        return;
    const store = readStore();
    const current = normalizeHiddenRows(store.byTenant[key]);
    const next = current.filter((row) => !(0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(row.id, id));
    if (next.length === current.length)
        return;
    if (next.length)
        store.byTenant[key] = next;
    else
        delete store.byTenant[key];
    writeStore(store);
}
