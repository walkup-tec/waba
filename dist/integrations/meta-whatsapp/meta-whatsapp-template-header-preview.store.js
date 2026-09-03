"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.headerHandleFromComponents = headerHandleFromComponents;
exports.headerHttpsUrlFromComponents = headerHttpsUrlFromComponents;
exports.saveTemplateHeaderPreview = saveTemplateHeaderPreview;
exports.copyTemplateHeaderPreview = copyTemplateHeaderPreview;
exports.templateHeaderPreviewKeys = templateHeaderPreviewKeys;
exports.aliasTemplateHeaderPreview = aliasTemplateHeaderPreview;
exports.bindTemplateHeaderPreview = bindTemplateHeaderPreview;
exports.saveTemplateHeaderPreviewAliases = saveTemplateHeaderPreviewAliases;
exports.readTemplateHeaderPreviewForSend = readTemplateHeaderPreviewForSend;
exports.readTemplateHeaderPreview = readTemplateHeaderPreview;
exports.hasTemplateHeaderPreview = hasTemplateHeaderPreview;
exports.publicTemplateHeaderPreviewUrl = publicTemplateHeaderPreviewUrl;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return "";
    if (TENANT_ID_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function handleKey(handle) {
    return (0, node_crypto_1.createHash)("sha256").update(String(handle || "").trim()).digest("hex").slice(0, 40);
}
function headersDir(tenantId) {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "template-headers", safeTenantId(tenantId));
}
function headerHandleFromComponents(components) {
    if (!Array.isArray(components))
        return "";
    for (const item of components) {
        const row = asRecord(item);
        if (String(row.type || "").trim().toUpperCase() !== "HEADER")
            continue;
        const example = asRecord(row.example);
        const handles = Array.isArray(example.header_handle) ? example.header_handle : [];
        const handle = String(handles[0] || "").trim();
        if (handle)
            return handle;
    }
    return "";
}
function headerHttpsUrlFromComponents(components) {
    const handle = headerHandleFromComponents(components);
    if (/^https:\/\//i.test(handle))
        return handle;
    return null;
}
function extFromMime(mime, fileName) {
    const type = String(mime || "").trim().toLowerCase();
    const name = String(fileName || "").trim().toLowerCase();
    if (type === "image/png" || name.endsWith(".png"))
        return "png";
    if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg"))
        return "jpg";
    if (type === "video/mp4" || name.endsWith(".mp4"))
        return "mp4";
    if (type === "application/pdf" || name.endsWith(".pdf"))
        return "pdf";
    return "bin";
}
function mimeFromExt(ext) {
    if (ext === "png")
        return "image/png";
    if (ext === "jpg")
        return "image/jpeg";
    if (ext === "mp4")
        return "video/mp4";
    if (ext === "pdf")
        return "application/pdf";
    return "application/octet-stream";
}
function filePath(tenantId, handle, ext) {
    return node_path_1.default.join(headersDir(tenantId), `${handleKey(handle)}.${ext}`);
}
function saveTemplateHeaderPreview(input) {
    const tenantId = safeTenantId(input.tenantId);
    const handle = String(input.handle || "").trim();
    if (!tenantId || !handle || !input.bytes?.length)
        return;
    const ext = extFromMime(input.mime || "", input.fileName || "");
    (0, node_fs_1.mkdirSync)(headersDir(input.tenantId), { recursive: true });
    (0, node_fs_1.writeFileSync)(filePath(input.tenantId, handle, ext), input.bytes);
}
function copyTemplateHeaderPreview(input) {
    aliasTemplateHeaderPreview({
        tenantId: input.tenantId,
        fromKeys: [input.fromHandle],
        toKeys: input.toHandles,
    });
}
/** Chaves estáveis: o handle da Graph vira URL lookaside e alguns templates passam a compartilhar a mesma. */
function templateHeaderPreviewKeys(input) {
    const name = String(input.name || "").trim().toLowerCase();
    const language = String(input.language || "").trim();
    const keys = [
        String(input.handle || "").trim(),
        String(input.templateId || "").trim(),
        String(input.metaTemplateId || "").trim(),
        name && language ? `${name}::${language}` : "",
        name ? `name:${name}` : "",
    ].filter(Boolean);
    return [...new Set(keys)];
}
function aliasTemplateHeaderPreview(input) {
    let preview = null;
    for (const raw of input.fromKeys) {
        preview = readTemplateHeaderPreview(input.tenantId, raw);
        if (preview)
            break;
    }
    if (!preview)
        return false;
    for (const raw of input.toKeys) {
        const toHandle = String(raw || "").trim();
        if (!toHandle)
            continue;
        saveTemplateHeaderPreview({
            tenantId: input.tenantId,
            handle: toHandle,
            mime: preview.mime,
            bytes: preview.bytes,
        });
    }
    return true;
}
function bindTemplateHeaderPreview(input) {
    const toKeys = templateHeaderPreviewKeys(input);
    const fromKeys = templateHeaderPreviewKeys({
        handle: input.previousHandle || input.handle,
        templateId: input.templateId,
        metaTemplateId: input.metaTemplateId,
        name: input.name,
        language: input.language,
    });
    if (input.handle)
        fromKeys.unshift(String(input.handle).trim());
    if (input.previousHandle)
        fromKeys.unshift(String(input.previousHandle).trim());
    return aliasTemplateHeaderPreview({
        tenantId: input.tenantId,
        fromKeys: [...new Set(fromKeys.filter(Boolean))],
        toKeys,
    });
}
function saveTemplateHeaderPreviewAliases(input) {
    for (const alias of [...new Set(input.aliases.map((item) => String(item || "").trim()).filter(Boolean))]) {
        saveTemplateHeaderPreview({
            tenantId: input.tenantId,
            handle: alias,
            mime: input.mime,
            fileName: input.fileName,
            bytes: input.bytes,
        });
    }
}
function readTemplateHeaderPreviewForSend(input) {
    bindTemplateHeaderPreview(input);
    for (const key of templateHeaderPreviewKeys(input)) {
        const found = readTemplateHeaderPreview(input.tenantId, key);
        if (found)
            return found;
    }
    return null;
}
function readTemplateHeaderPreview(tenantId, handle) {
    const id = safeTenantId(tenantId);
    const key = String(handle || "").trim();
    if (!id || !key)
        return null;
    const dir = headersDir(tenantId);
    if (!(0, node_fs_1.existsSync)(dir))
        return null;
    for (const ext of ["png", "jpg", "mp4", "pdf", "bin"]) {
        const file = filePath(tenantId, key, ext);
        if (!(0, node_fs_1.existsSync)(file))
            continue;
        const bytes = (0, node_fs_1.readFileSync)(file);
        if (!bytes.length)
            continue;
        return { mime: mimeFromExt(ext), bytes };
    }
    return null;
}
function hasTemplateHeaderPreview(tenantId, handle) {
    return Boolean(readTemplateHeaderPreview(tenantId, handle));
}
function publicTemplateHeaderPreviewUrl(input) {
    const handle = headerHandleFromComponents(input.components);
    const id = String(input.id || "").trim();
    const hasLocal = Boolean(readTemplateHeaderPreviewForSend({
        tenantId: input.tenantId,
        handle,
        templateId: id,
        metaTemplateId: input.metaTemplateId || undefined,
        name: input.name || undefined,
        language: input.language || undefined,
    }));
    if (hasLocal && id) {
        return `/integrations/meta/whatsapp/templates/${encodeURIComponent(id)}/header`;
    }
    return null;
}
