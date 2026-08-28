"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPhoneIdentity = readPhoneIdentity;
exports.writePhoneIdentity = writePhoneIdentity;
exports.readPhonePhoto = readPhonePhoto;
exports.localPhonePhotoUrl = localPhonePhotoUrl;
exports.phoneIdentitySyncStatus = phoneIdentitySyncStatus;
exports.isPhoneInboxEnabled = isPhoneInboxEnabled;
exports.listPhoneInboxChannels = listPhoneInboxChannels;
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
        const vertical = String(row.vertical || "").trim() || null;
        const description = row.description === undefined || row.description === null ? null : String(row.description);
        const address = row.address === undefined || row.address === null ? null : String(row.address);
        const email = String(row.email || "").trim() || null;
        const photoMetaApplied = row.photoMetaApplied === true;
        const profileMetaApplied = row.profileMetaApplied === true;
        const inboxEnabled = row.inboxEnabled === false ? false : row.inboxEnabled === true ? true : null;
        const displayPhoneNumber = String(row.displayPhoneNumber || "").trim() || null;
        const channelName = String(row.channelName || "").trim() || null;
        const updatedAt = String(row.updatedAt || "").trim() || new Date().toISOString();
        return {
            name,
            photoExt,
            vertical,
            description,
            address,
            email,
            photoMetaApplied,
            profileMetaApplied,
            inboxEnabled,
            displayPhoneNumber,
            channelName,
            updatedAt,
        };
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
        vertical: null,
        description: null,
        address: null,
        email: null,
        photoMetaApplied: false,
        profileMetaApplied: false,
        inboxEnabled: null,
        displayPhoneNumber: null,
        channelName: null,
        updatedAt: "",
    };
    const bizTouched = input.vertical !== undefined ||
        input.description !== undefined ||
        input.address !== undefined ||
        input.email !== undefined;
    const next = {
        name: input.name !== undefined ? input.name : current.name,
        photoExt: current.photoExt,
        vertical: input.vertical !== undefined ? input.vertical : current.vertical,
        description: input.description !== undefined ? input.description : current.description,
        address: input.address !== undefined ? input.address : current.address,
        email: input.email !== undefined ? input.email : current.email,
        photoMetaApplied: input.photoMetaApplied !== undefined
            ? input.photoMetaApplied
            : input.photo
                ? false
                : current.photoMetaApplied,
        profileMetaApplied: input.profileMetaApplied !== undefined
            ? input.profileMetaApplied
            : bizTouched
                ? false
                : current.profileMetaApplied,
        inboxEnabled: input.inboxEnabled !== undefined ? input.inboxEnabled : current.inboxEnabled,
        displayPhoneNumber: input.displayPhoneNumber !== undefined ? input.displayPhoneNumber : current.displayPhoneNumber,
        channelName: input.channelName !== undefined ? input.channelName : current.channelName,
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
function namesMatch(local, meta) {
    const a = String(local || "").trim().toLowerCase();
    const b = String(meta || "").trim().toLowerCase();
    return Boolean(a) && a === b;
}
function textsMatch(local, meta) {
    return String(local || "").trim() === String(meta || "").trim() && Boolean(String(local || "").trim());
}
function hasMetaPhoto(url) {
    return /^https:\/\//i.test(String(url || "").trim());
}
function phoneIdentitySyncStatus(input) {
    return {
        nameSyncStatus: input.localName ? (namesMatch(input.localName, input.metaVerifiedName) ? "applied" : "pending") : null,
        photoSyncStatus: input.localPhoto
            ? input.photoMetaApplied || hasMetaPhoto(input.metaProfilePictureUrl)
                ? "applied"
                : "pending"
            : null,
        profileSyncStatus: input.localDescription
            ? input.profileMetaApplied || textsMatch(input.localDescription, input.metaDescription)
                ? "applied"
                : "pending"
            : null,
    };
}
function isPhoneInboxEnabled(identity) {
    return identity?.inboxEnabled !== false;
}
function listPhoneInboxChannels(tenantId) {
    try {
        const dir = tenantDir(tenantId);
        if (!(0, node_fs_1.existsSync)(dir))
            return [];
        const out = [];
        for (const file of (0, node_fs_1.readdirSync)(dir)) {
            if (!file.endsWith(".json"))
                continue;
            const phoneNumberId = file.slice(0, -5);
            const identity = readPhoneIdentity(tenantId, phoneNumberId);
            if (!identity)
                continue;
            out.push({
                phoneNumberId,
                name: identity.channelName || identity.name,
                displayPhoneNumber: identity.displayPhoneNumber,
                profilePictureUrl: localPhonePhotoUrl(phoneNumberId, identity),
                inboxEnabled: isPhoneInboxEnabled(identity),
            });
        }
        return out;
    }
    catch {
        return [];
    }
}
function applyLocalPhoneIdentities(tenantId, numbers) {
    return numbers.map((row) => {
        const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
        if (!identity) {
            return {
                ...row,
                requestedName: null,
                nameSyncStatus: null,
                photoSyncStatus: null,
                profileSyncStatus: null,
                inboxEnabled: true,
            };
        }
        const sync = phoneIdentitySyncStatus({
            localName: identity.name,
            localPhoto: Boolean(identity.photoExt),
            localDescription: String(identity.description || "").trim() || null,
            metaVerifiedName: row.verifiedName,
            metaProfilePictureUrl: row.profilePictureUrl,
            metaDescription: row.description,
            photoMetaApplied: identity.photoMetaApplied,
            profileMetaApplied: identity.profileMetaApplied,
        });
        const nameApplied = sync.nameSyncStatus === "applied";
        const photoApplied = sync.photoSyncStatus === "applied";
        const profileApplied = sync.profileSyncStatus === "applied";
        return {
            ...row,
            requestedName: identity.name && !nameApplied ? identity.name : null,
            verifiedName: nameApplied ? identity.name || row.verifiedName : row.verifiedName,
            profilePictureUrl: photoApplied
                ? localPhonePhotoUrl(row.phoneNumberId, identity) || row.profilePictureUrl
                : row.profilePictureUrl,
            vertical: profileApplied ? identity.vertical || row.vertical : row.vertical,
            description: profileApplied ? identity.description ?? row.description : row.description,
            address: profileApplied ? identity.address ?? row.address : row.address,
            email: profileApplied ? identity.email || row.email : row.email,
            nameSyncStatus: sync.nameSyncStatus,
            photoSyncStatus: sync.photoSyncStatus,
            profileSyncStatus: sync.profileSyncStatus,
            inboxEnabled: isPhoneInboxEnabled(identity),
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
