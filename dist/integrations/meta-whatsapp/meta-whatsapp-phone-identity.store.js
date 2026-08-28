"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPhoneIdentity = readPhoneIdentity;
exports.writePhoneIdentity = writePhoneIdentity;
exports.readPhonePhoto = readPhonePhoto;
exports.localPhonePhotoUrl = localPhonePhotoUrl;
exports.applyLocalPhoneIdentities = applyLocalPhoneIdentities;
exports.purgePhoneIdentities = purgePhoneIdentities;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const PHONE_ID_RE = /^[a-zA-Z0-9._-]{4,80}$/;
function safeTenantId(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        throw new Error("Identidade do número inválida.");
    if (TENANT_ID_RE.test(id))
        return id;
    return (0, node_crypto_1.createHash)("sha256").update(id).digest("hex").slice(0, 40);
}
function safePhoneId(phoneNumberId) {
    const id = String(phoneNumberId || "").trim();
    if (!PHONE_ID_RE.test(id))
        throw new Error("Identidade do número inválida.");
    return id;
}
function tenantDir(tenantId) {
    return node_path_1.default.join((0, data_path_1.resolveDataDir)(), "meta-whatsapp", "phone-identity", safeTenantId(tenantId));
}
function jsonPath(tenantId, phoneNumberId) {
    return node_path_1.default.join(tenantDir(tenantId), `${safePhoneId(phoneNumberId)}.json`);
}
function photoPath(tenantId, phoneNumberId, ext) {
    return node_path_1.default.join(tenantDir(tenantId), `${safePhoneId(phoneNumberId)}.${ext}`);
}
function ensureDir(tenantId) {
    (0, node_fs_1.mkdirSync)(tenantDir(tenantId), { recursive: true });
}
function readPhoneIdentity(tenantId, phoneNumberId) {
    try {
        const file = jsonPath(tenantId, phoneNumberId);
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
function writePhoneIdentity(tenantId, phoneNumberId, input) {
    ensureDir(tenantId);
    const current = readPhoneIdentity(tenantId, phoneNumberId) || {
        name: null,
        photoExt: null,
        updatedAt: "",
    };
    const next = {
        name: input.name !== undefined ? input.name : current.name,
        photoExt: current.photoExt,
        updatedAt: new Date().toISOString(),
    };
    if (input.photo) {
        if (current.photoExt && current.photoExt !== input.photo.ext) {
            const previous = photoPath(tenantId, phoneNumberId, current.photoExt);
            if ((0, node_fs_1.existsSync)(previous))
                (0, node_fs_1.unlinkSync)(previous);
        }
        (0, node_fs_1.writeFileSync)(photoPath(tenantId, phoneNumberId, input.photo.ext), input.photo.bytes);
        next.photoExt = input.photo.ext;
    }
    (0, node_fs_1.writeFileSync)(jsonPath(tenantId, phoneNumberId), JSON.stringify(next), "utf8");
    return next;
}
function readPhonePhoto(tenantId, phoneNumberId) {
    const identity = readPhoneIdentity(tenantId, phoneNumberId);
    if (!identity?.photoExt)
        return null;
    const file = photoPath(tenantId, phoneNumberId, identity.photoExt);
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
function localPhonePhotoUrl(phoneNumberId, identity) {
    if (!identity?.photoExt)
        return null;
    return `/integrations/meta/whatsapp/phone-numbers/photo?id=${encodeURIComponent(phoneNumberId)}&v=${encodeURIComponent(identity.updatedAt)}`;
}
function applyLocalPhoneIdentities(tenantId, numbers) {
    return numbers.map((row) => {
        const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
        if (!identity)
            return row;
        return {
            ...row,
            verifiedName: identity.name || row.verifiedName,
            profilePictureUrl: localPhonePhotoUrl(row.phoneNumberId, identity) || row.profilePictureUrl,
        };
    });
}
function purgePhoneIdentities(tenantId) {
    try {
        const dir = tenantDir(tenantId);
        if ((0, node_fs_1.existsSync)(dir))
            (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
    }
    catch {
        // ignore
    }
}
