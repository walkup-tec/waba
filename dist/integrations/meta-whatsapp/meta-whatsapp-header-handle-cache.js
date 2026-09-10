"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEADER_HANDLE_CACHE_TTL_MS = void 0;
exports.headerFileSha256 = headerFileSha256;
exports.readCachedHeaderHandle = readCachedHeaderHandle;
exports.writeCachedHeaderHandle = writeCachedHeaderHandle;
exports.readPersistedHeaderHandle = readPersistedHeaderHandle;
exports.clearHeaderHandleCacheForTests = clearHeaderHandleCacheForTests;
exports.isHeaderUploadAppRateLimit = isHeaderUploadAppRateLimit;
exports.isResumableUploadHandle = isResumableUploadHandle;
exports.pickReusableHeaderHandle = pickReusableHeaderHandle;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_template_header_preview_store_1 = require("./meta-whatsapp-template-header-preview.store");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
/** Handle 4:: da Graph costuma valer horas/dias; 45 min forçava upload de novo e queimava cota. */
exports.HEADER_HANDLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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
/** Lê handle gravado mesmo depois do TTL — último recurso quando POST /uploads está em código 4. */
function readPersistedHeaderHandle(tenantId, sha) {
    const id = safeTenantId(tenantId);
    const hash = String(sha || "").trim().toLowerCase();
    if (!id || !/^[a-f0-9]{64}$/.test(hash))
        return "";
    const mem = memory.get(memoryKey(tenantId, hash));
    if (mem?.handle)
        return mem.handle;
    const file = handlePath(tenantId, hash);
    if (!(0, node_fs_1.existsSync)(file))
        return "";
    try {
        const row = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        return String(row.handle || "").trim();
    }
    catch {
        return "";
    }
}
function clearHeaderHandleCacheForTests() {
    memory.clear();
}
function isHeaderUploadAppRateLimit(error) {
    const msg = String(error?.message || "").replace(/\s+/g, " ");
    return /código\s*4\b|limitou temporariamente|application request limit|#\s*4\)/i.test(msg);
}
function isResumableUploadHandle(handle) {
    return /^4[:;]/.test(String(handle || "").trim());
}
function pickReusableHeaderHandle(input) {
    const sha = headerFileSha256(input.bytes);
    if (!sha || !input.bytes?.length)
        return { resumable: "", any: "" };
    let any = "";
    for (const row of input.rows) {
        const handle = (0, meta_whatsapp_template_header_preview_store_1.headerHandleFromComponents)(row.components);
        if (!handle)
            continue;
        const preview = (0, meta_whatsapp_template_header_preview_store_1.readTemplateHeaderPreviewForSend)({
            tenantId: input.tenantId,
            handle,
            templateId: row.id,
            metaTemplateId: row.metaTemplateId,
            name: row.name,
            language: row.language,
        });
        if (!preview?.bytes?.length)
            continue;
        if (headerFileSha256(preview.bytes) !== sha)
            continue;
        if (!any)
            any = handle;
        if (isResumableUploadHandle(handle)) {
            writeCachedHeaderHandle(input.tenantId, sha, handle);
            return { resumable: handle, any: handle };
        }
    }
    return { resumable: "", any };
}
