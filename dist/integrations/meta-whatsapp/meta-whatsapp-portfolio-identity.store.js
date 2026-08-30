"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPortfolioIdentity = readPortfolioIdentity;
exports.writePortfolioIdentity = writePortfolioIdentity;
exports.readPortfolioPhoto = readPortfolioPhoto;
exports.localPortfolioPhotoUrl = localPortfolioPhotoUrl;
exports.applyLocalPortfolioIdentity = applyLocalPortfolioIdentity;
exports.writePortfolioBusinessPhoto = writePortfolioBusinessPhoto;
exports.readPortfolioBusinessPhoto = readPortfolioBusinessPhoto;
exports.localPortfolioBusinessPhotoUrl = localPortfolioBusinessPhotoUrl;
exports.applyLocalPortfolioBusinessPhoto = applyLocalPortfolioBusinessPhoto;
exports.purgePortfolioIdentity = purgePortfolioIdentity;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
function identityDir() {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "portfolio-identity");
}
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        throw new Error("Identidade do portfólio inválida.");
    if (TENANT_ID_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function jsonPath(tenantId) {
    return node_path_1.default.join(identityDir(), `${safeTenantId(tenantId)}.json`);
}
function photoPath(tenantId, ext) {
    return node_path_1.default.join(identityDir(), `${safeTenantId(tenantId)}.${ext}`);
}
function ensureDir() {
    (0, node_fs_1.mkdirSync)(identityDir(), { recursive: true });
}
function readPortfolioIdentity(tenantId) {
    try {
        const file = jsonPath(tenantId);
        if (!(0, node_fs_1.existsSync)(file))
            return null;
        const row = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        const photoExt = row.photoExt === "png" || row.photoExt === "jpg" ? row.photoExt : null;
        const name = String(row.name || "").trim() || null;
        const updatedAt = String(row.updatedAt || "").trim() || new Date().toISOString();
        return { name, photoExt, updatedAt };
    }
    catch {
        return null;
    }
}
function writePortfolioIdentity(tenantId, input) {
    ensureDir();
    const current = readPortfolioIdentity(tenantId) || { name: null, photoExt: null, updatedAt: "" };
    const next = {
        name: input.name !== undefined ? input.name : current.name,
        photoExt: current.photoExt,
        updatedAt: new Date().toISOString(),
    };
    if (input.photo) {
        if (current.photoExt && current.photoExt !== input.photo.ext) {
            const previous = photoPath(tenantId, current.photoExt);
            if ((0, node_fs_1.existsSync)(previous))
                (0, node_fs_1.unlinkSync)(previous);
        }
        (0, node_fs_1.writeFileSync)(photoPath(tenantId, input.photo.ext), input.photo.bytes);
        next.photoExt = input.photo.ext;
    }
    (0, node_fs_1.writeFileSync)(jsonPath(tenantId), JSON.stringify(next), "utf8");
    return next;
}
function readPortfolioPhoto(tenantId) {
    const identity = readPortfolioIdentity(tenantId);
    if (!identity?.photoExt)
        return null;
    const file = photoPath(tenantId, identity.photoExt);
    if (!(0, node_fs_1.existsSync)(file))
        return null;
    const bytes = (0, node_fs_1.readFileSync)(file);
    if (!bytes.length)
        return null;
    return {
        mime: identity.photoExt === "png" ? "image/png" : "image/jpeg",
        bytes,
    };
}
function localPortfolioPhotoUrl(identity) {
    if (!identity?.photoExt)
        return null;
    return `/integrations/meta/whatsapp/portfolio/photo?v=${encodeURIComponent(identity.updatedAt)}`;
}
function applyLocalPortfolioIdentity(tenantId, portfolio) {
    const identity = readPortfolioIdentity(tenantId);
    if (!identity)
        return portfolio;
    return {
        ...portfolio,
        name: identity.name || portfolio.name,
        profilePictureUrl: localPortfolioPhotoUrl(identity) || portfolio.profilePictureUrl,
    };
}
function safeBusinessId(businessId) {
    const id = String(businessId || "").trim();
    return /^\d{5,20}$/.test(id) ? id : null;
}
function businessPhotoBase(tenantId, businessId) {
    const biz = safeBusinessId(businessId);
    if (!biz)
        return null;
    return node_path_1.default.join(identityDir(), `${safeTenantId(tenantId)}-${biz}`);
}
function writePortfolioBusinessPhoto(tenantId, businessId, photo) {
    const base = businessPhotoBase(tenantId, businessId);
    if (!base)
        return null;
    ensureDir();
    for (const ext of ["png", "jpg"]) {
        const previous = `${base}.${ext}`;
        if (ext !== photo.ext && (0, node_fs_1.existsSync)(previous))
            (0, node_fs_1.unlinkSync)(previous);
    }
    (0, node_fs_1.writeFileSync)(`${base}.${photo.ext}`, photo.bytes);
    const updatedAt = new Date().toISOString();
    (0, node_fs_1.writeFileSync)(`${base}.json`, JSON.stringify({ photoExt: photo.ext, updatedAt }), "utf8");
    return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}&v=${encodeURIComponent(updatedAt)}`;
}
function readPortfolioBusinessPhoto(tenantId, businessId) {
    const base = businessPhotoBase(tenantId, businessId);
    if (!base)
        return null;
    try {
        const meta = (0, node_fs_1.existsSync)(`${base}.json`)
            ? JSON.parse((0, node_fs_1.readFileSync)(`${base}.json`, "utf8"))
            : {};
        const ext = meta.photoExt === "png" || meta.photoExt === "jpg" ? meta.photoExt : (0, node_fs_1.existsSync)(`${base}.png`) ? "png" : (0, node_fs_1.existsSync)(`${base}.jpg`) ? "jpg" : null;
        if (!ext)
            return null;
        const file = `${base}.${ext}`;
        if (!(0, node_fs_1.existsSync)(file))
            return null;
        const bytes = (0, node_fs_1.readFileSync)(file);
        if (!bytes.length)
            return null;
        return { mime: ext === "png" ? "image/png" : "image/jpeg", bytes };
    }
    catch {
        return null;
    }
}
function localPortfolioBusinessPhotoUrl(tenantId, businessId) {
    const base = businessPhotoBase(tenantId, businessId);
    if (!base || !(0, node_fs_1.existsSync)(`${base}.json`)) {
        if (base && ((0, node_fs_1.existsSync)(`${base}.png`) || (0, node_fs_1.existsSync)(`${base}.jpg`))) {
            return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}`;
        }
        return null;
    }
    try {
        const row = JSON.parse((0, node_fs_1.readFileSync)(`${base}.json`, "utf8"));
        if (row.photoExt !== "png" && row.photoExt !== "jpg")
            return null;
        const updatedAt = String(row.updatedAt || "").trim();
        return `/integrations/meta/whatsapp/portfolio/photo?businessId=${encodeURIComponent(String(businessId).trim())}${updatedAt ? `&v=${encodeURIComponent(updatedAt)}` : ""}`;
    }
    catch {
        return null;
    }
}
function applyLocalPortfolioBusinessPhoto(tenantId, portfolio) {
    const id = String(portfolio.id || "").trim();
    const local = id ? localPortfolioBusinessPhotoUrl(tenantId, id) : null;
    if (!local)
        return portfolio;
    return { ...portfolio, profilePictureUrl: local };
}
function purgePortfolioIdentity(tenantId) {
    try {
        const id = safeTenantId(tenantId);
        const dir = identityDir();
        if (!(0, node_fs_1.existsSync)(dir))
            return;
        for (const file of (0, node_fs_1.readdirSync)(dir)) {
            if (file === `${id}.json` || file === `${id}.png` || file === `${id}.jpg` || file.startsWith(`${id}-`)) {
                (0, node_fs_1.unlinkSync)(node_path_1.default.join(dir, file));
            }
        }
    }
    catch {
        // ignore
    }
}
