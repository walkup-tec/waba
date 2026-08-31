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
exports.phoneInboxDisplayName = phoneInboxDisplayName;
exports.listPhoneInboxChannels = listPhoneInboxChannels;
exports.listEnabledInboxPhoneIds = listEnabledInboxPhoneIds;
exports.inboxQueryPhoneIds = inboxQueryPhoneIds;
exports.isInboxPhoneAllowed = isInboxPhoneAllowed;
exports.resolveInboxSendPhoneNumberId = resolveInboxSendPhoneNumberId;
exports.applyLocalPhoneIdentities = applyLocalPhoneIdentities;
exports.purgePhoneIdentities = purgePhoneIdentities;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_portfolio_map_1 = require("./meta-whatsapp-portfolio.map");
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
        const photoSource = String(row.photoSource || "").trim() || null;
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
            photoSource,
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
        photoSource: null,
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
        photoSource: input.photoSource !== undefined ? input.photoSource : current.photoSource,
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
function textsMatch(local, meta) {
    return String(local || "").trim() === String(meta || "").trim() && Boolean(String(local || "").trim());
}
function phoneIdentitySyncStatus(input) {
    return {
        photoSyncStatus: input.localPhoto ? (input.photoMetaApplied ? "applied" : "pending") : null,
        profileSyncStatus: input.localDescription
            ? input.profileMetaApplied || textsMatch(input.localDescription, input.metaDescription)
                ? "applied"
                : "pending"
            : null,
    };
}
function isPhoneInboxEnabled(identity) {
    return identity?.inboxEnabled === true;
}
function phoneInboxDisplayName(identity) {
    const channel = String(identity?.channelName || "").trim();
    if (channel)
        return channel;
    const saved = String(identity?.name || "").trim();
    return saved || null;
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
                name: phoneInboxDisplayName(identity),
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
function listEnabledInboxPhoneIds(tenantId) {
    return listPhoneInboxChannels(tenantId)
        .filter((row) => row.inboxEnabled)
        .map((row) => String(row.phoneNumberId || "").trim())
        .filter(Boolean);
}
function asPhoneIds(value) {
    const list = Array.isArray(value) ? value : [value];
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const id = String(item || "").trim();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
function inboxQueryPhoneIds(tenantId, connectionPhoneNumberId, selectedPhoneNumberId) {
    const enabled = listEnabledInboxPhoneIds(tenantId);
    const conns = asPhoneIds(connectionPhoneNumberId);
    const selected = String(selectedPhoneNumberId || "").trim();
    const extras = enabled.length === 1 ? conns.filter((id) => !enabled.includes(id)) : [];
    const aliases = [...enabled, ...extras];
    if (!selected)
        return aliases;
    if (enabled.length === 1 && aliases.includes(selected))
        return aliases;
    return enabled.includes(selected) ? [selected] : [];
}
function isInboxPhoneAllowed(tenantId, phoneNumberId, connectionPhoneNumberId) {
    const id = String(phoneNumberId || "").trim();
    if (!id)
        return false;
    const enabled = listEnabledInboxPhoneIds(tenantId);
    if (enabled.includes(id))
        return true;
    const conns = asPhoneIds(connectionPhoneNumberId);
    return enabled.length === 1 && conns.includes(id) && enabled[0] !== id;
}
function resolveInboxSendPhoneNumberId(input) {
    const enabled = listEnabledInboxPhoneIds(input.tenantId);
    const conversation = String(input.conversationPhoneNumberId || "").trim();
    const requested = String(input.requestedPhoneNumberId || "").trim();
    const connection = String(input.connectionPhoneNumberId || "").trim();
    if (conversation && enabled.includes(conversation))
        return conversation;
    if (conversation && enabled.length === 1 && conversation === connection)
        return enabled[0] || null;
    if (requested && enabled.includes(requested))
        return requested;
    if (connection && enabled.includes(connection))
        return connection;
    if (enabled.length === 1)
        return enabled[0] || null;
    return connection || null;
}
function applyLocalPhoneIdentities(tenantId, numbers) {
    return numbers.map((row) => {
        const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
        const nameSync = (0, meta_whatsapp_portfolio_map_1.resolvePhoneNameSync)({
            verifiedName: row.verifiedName,
            nameStatus: row.nameStatus,
            newDisplayName: row.newDisplayName,
            newNameStatus: row.newNameStatus,
        });
        const connected = (0, meta_whatsapp_portfolio_map_1.isMetaPhoneConnected)(row.metaStatus);
        const localPhoto = localPhonePhotoUrl(row.phoneNumberId, identity);
        return {
            ...row,
            requestedName: nameSync.requestedName,
            nameSyncStatus: nameSync.nameSyncStatus,
            nameNeedsRegister: nameSync.nameNeedsRegister,
            canActivate: !connected || nameSync.nameNeedsRegister,
            profilePictureUrl: localPhoto || row.profilePictureUrl,
            inboxEnabled: isPhoneInboxEnabled(identity),
            photoSyncStatus: localPhoto ? "applied" : row.photoSyncStatus,
            profileSyncStatus: row.profileSyncStatus,
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
