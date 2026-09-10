"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEADER_HANDLE_CACHE_TTL_MS = void 0;
exports.headerFileSha256 = headerFileSha256;
exports.readCachedHeaderHandle = readCachedHeaderHandle;
exports.writeCachedHeaderHandle = writeCachedHeaderHandle;
exports.clearHeaderHandleCacheForTests = clearHeaderHandleCacheForTests;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
exports.HEADER_HANDLE_CACHE_TTL_MS = 45 * 60 * 1000;
const memory = new Map();
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return "";
    if (TENANT_ID_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function headerFileSha256(bytes) {
    return (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function memoryKey(tenantId, sha) {
    return `${safeTenantId(tenantId)}:${String(sha || "").trim().toLowerCase()}`;
}
function handleDir(tenantId) {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "template-headers", safeTenantId(tenantId), "handles");
}
function handlePath(tenantId, sha) {
    return node_path_1.default.join(handleDir(tenantId), `${String(sha || "").trim().toLowerCase()}.json`);
}
function stillFresh(at, now) {
    return Number.isFinite(at) && now - at >= 0 && now - at <= exports.HEADER_HANDLE_CACHE_TTL_MS;
}
function readCachedHeaderHandle(tenantId, sha, now = Date.now()) {
    const id = safeTenantId(tenantId);
    const hash = String(sha || "").trim().toLowerCase();
    if (!id || !/^[a-f0-9]{64}$/.test(hash))
        return "";
    const mem = memory.get(memoryKey(tenantId, hash));
    if (mem && stillFresh(mem.at, now) && mem.handle)
        return mem.handle;
    if (mem)
        memory.delete(memoryKey(tenantId, hash));
    const file = handlePath(tenantId, hash);
    if (!(0, node_fs_1.existsSync)(file))
        return "";
    try {
        const row = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        const handle = String(row.handle || "").trim();
        const at = Number(row.at || 0);
        if (!handle || !stillFresh(at, now))
            return "";
        memory.set(memoryKey(tenantId, hash), { handle, at });
        return handle;
    }
    catch {
        return "";
    }
}
function writeCachedHeaderHandle(tenantId, sha, handle, now = Date.now()) {
    const id = safeTenantId(tenantId);
    const hash = String(sha || "").trim().toLowerCase();
    const value = String(handle || "").trim();
    if (!id || !/^[a-f0-9]{64}$/.test(hash) || !value)
        return;
    const row = { handle: value, at: now };
    memory.set(memoryKey(tenantId, hash), row);
    (0, node_fs_1.mkdirSync)(handleDir(tenantId), { recursive: true });
    (0, node_fs_1.writeFileSync)(handlePath(tenantId, hash), JSON.stringify(row));
}
function clearHeaderHandleCacheForTests() {
    memory.clear();
}
