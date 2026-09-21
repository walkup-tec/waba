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
exports.isPhoneBotEnabled = isPhoneBotEnabled;
exports.isConnectionAccountRestricted = isConnectionAccountRestricted;
exports.isPhoneAutomationEligible = isPhoneAutomationEligible;
exports.isPhoneInboxEligible = isPhoneInboxEligible;
exports.isPhoneBotEligible = isPhoneBotEligible;
exports.phoneInboxDisplayName = phoneInboxDisplayName;
exports.syncInboxChannelNameFromMeta = syncInboxChannelNameFromMeta;
exports.listPhoneInboxChannels = listPhoneInboxChannels;
exports.listEnabledInboxPhoneIds = listEnabledInboxPhoneIds;
exports.markPhoneIdentitiesRestrictedForBusiness = markPhoneIdentitiesRestrictedForBusiness;
exports.inboxQueryPhoneIds = inboxQueryPhoneIds;
exports.isInboxPhoneAllowed = isInboxPhoneAllowed;
exports.resolveInboxSendPhoneNumberId = resolveInboxSendPhoneNumberId;
exports.applyLocalPhoneIdentities = applyLocalPhoneIdentities;
exports.purgePhoneIdentities = purgePhoneIdentities;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const data_path_1 = require("../../data-path");
const meta_whatsapp_phone_profile_1 = require("./meta-whatsapp-phone-profile");
const meta_whatsapp_portfolio_map_1 = require("./meta-whatsapp-portfolio.map");
const meta_whatsapp_hidden_business_store_1 = require("./meta-whatsapp-hidden-business.store");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const PHONE_ID_RE = /^[a-zA-Z0-9._-]{4,80}$/;
function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function phonesMatch(left, right) {
    const a = phoneDigits(left);
    const b = phoneDigits(right);
    if (!a || !b)
        return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
}
function parseStoredUiStatus(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "ativo" || raw === "pendente" || raw === "restrito")
        return raw;
    return null;
}
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
        const botEnabled = row.botEnabled === false ? false : row.botEnabled === true ? true : null;
        const uiStatus = parseStoredUiStatus(row.uiStatus);
        const portfolioHidden = row.portfolioHidden === true ? true : row.portfolioHidden === false ? false : null;
        const businessId = String(row.businessId || "").replace(/\D/g, "") || null;
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
            botEnabled,
            uiStatus,
            portfolioHidden,
            businessId,
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
        botEnabled: null,
        uiStatus: null,
        portfolioHidden: null,
        businessId: null,
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
        botEnabled: input.botEnabled !== undefined ? input.botEnabled : current.botEnabled,
        uiStatus: input.uiStatus !== undefined ? input.uiStatus : current.uiStatus,
        portfolioHidden: input.portfolioHidden !== undefined ? input.portfolioHidden : current.portfolioHidden,
        businessId: input.businessId !== undefined
            ? String(input.businessId || "").replace(/\D/g, "") || null
            : current.businessId,
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
function isPhoneBotEnabled(identity) {
    return identity?.botEnabled === true;
}
function connectionMatchesPhone(row, phoneNumberId, identity) {
    const chip = String(row.phoneNumberId || "").trim();
    if (chip && chip === phoneNumberId)
        return true;
    if (phonesMatch(row.displayPhoneNumber, identity?.displayPhoneNumber))
        return true;
    return false;
}
function hiddenIdMatches(tenantId, value) {
    const id = String(value || "").trim();
    if (!id)
        return false;
    if ((0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenantId, id))
        return true;
    return (0, meta_whatsapp_hidden_business_store_1.listHiddenBusinessIds)(tenantId).some((hidden) => (0, meta_whatsapp_known_owned_wabas_1.knownOwnedBusinessesMatch)(id, hidden) || (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, hidden));
}
/** Conexão cuja BM/WABA está em Restritas — não serve o Atendimento. */
function isConnectionAccountRestricted(tenantId, row) {
    const tenant = String(tenantId || "").trim();
    if (!tenant)
        return false;
    if (hiddenIdMatches(tenant, row.metaBusinessId) || hiddenIdMatches(tenant, row.wabaId))
        return true;
    for (const businessId of (0, meta_whatsapp_known_owned_wabas_1.knownBusinessIdsForWaba)(String(row.wabaId || ""))) {
        if (hiddenIdMatches(tenant, businessId))
            return true;
    }
    for (const businessId of (0, meta_whatsapp_known_owned_wabas_1.knownBusinessIdsForDisplayPhone)(row.displayPhoneNumber)) {
        if (hiddenIdMatches(tenant, businessId))
            return true;
    }
    const waba = String(row.wabaId || "").trim();
    if (waba) {
        for (const hidden of (0, meta_whatsapp_hidden_business_store_1.listHiddenBusinessIds)(tenant)) {
            if ((0, meta_whatsapp_known_owned_wabas_1.equivalentOwnedWabaIdsForBusiness)(hidden, waba).includes(waba))
                return true;
        }
    }
    return false;
}
function accountIsRestricted(_tenantId, phoneNumberId, identity, connections) {
    if (identity?.portfolioHidden === true)
        return true;
    const ownDisplay = String(identity?.displayPhoneNumber || "").trim();
    if ((0, meta_whatsapp_known_owned_wabas_1.isWithdrawnInboxDisplayPhone)(ownDisplay))
        return true;
    if (ownDisplay)
        return false;
    const hinted = (connections || []).find((row) => String(row.phoneNumberId || "").trim() === String(phoneNumberId || "").trim());
    return (0, meta_whatsapp_known_owned_wabas_1.isWithdrawnInboxDisplayPhone)(hinted?.displayPhoneNumber);
}
/** Chip ativo em ATIVAS, sem restrição. Inbox não entra nesta conta. */
function isPhoneAutomationEligible(identity, tenantId, connections, phoneNumberId) {
    if (!identity)
        return false;
    if (identity.uiStatus === "pendente" || identity.uiStatus === "restrito")
        return false;
    if ((0, meta_whatsapp_known_owned_wabas_1.isWithdrawnInboxDisplayPhone)(identity.displayPhoneNumber))
        return false;
    const tenant = String(tenantId || "").trim();
    const phone = String(phoneNumberId || "").trim();
    if (tenant && accountIsRestricted(tenant, phone, identity, connections))
        return false;
    return true;
}
/** Inbox ligado, chip Ativo, portfólio ATIVAS. A restrição é do chip, não da conexão. */
function isPhoneInboxEligible(identity, tenantId, connections, phoneNumberId) {
    if (!isPhoneInboxEnabled(identity) || !identity)
        return false;
    return isPhoneAutomationEligible(identity, tenantId, connections, phoneNumberId);
}
/** Única regra do Bots: o chip precisa estar marcado BOT. */
function isPhoneBotEligible(identity) {
    return isPhoneBotEnabled(identity);
}
function phoneInboxDisplayName(identity, verifiedNameFromMeta) {
    const meta = String(verifiedNameFromMeta || "").trim();
    if (meta)
        return meta;
    const channel = String(identity?.channelName || "").trim();
    if (channel)
        return channel;
    const saved = String(identity?.name || "").trim();
    return saved || null;
}
/** Mantém o rótulo do Inbox alinhado ao verified_name da Meta (ignora nome local do Editar). */
function syncInboxChannelNameFromMeta(tenantId, phoneNumberId, verifiedName, displayPhoneNumber) {
    const id = String(phoneNumberId || "").trim();
    const name = String(verifiedName || "").trim();
    if (!id || !name)
        return;
    const current = readPhoneIdentity(tenantId, id);
    if (!current || current.inboxEnabled !== true)
        return;
    const phone = displayPhoneNumber !== undefined ? String(displayPhoneNumber || "").trim() || null : undefined;
    if (current.channelName === name && (phone === undefined || current.displayPhoneNumber === phone)) {
        return;
    }
    writePhoneIdentity(tenantId, id, {
        channelName: name,
        ...(phone !== undefined ? { displayPhoneNumber: phone } : {}),
    });
}
function lookupVerifiedName(verifiedNameByPhone, phoneNumberId) {
    if (!verifiedNameByPhone)
        return undefined;
    if (verifiedNameByPhone instanceof Map) {
        return verifiedNameByPhone.get(phoneNumberId);
    }
    const record = verifiedNameByPhone;
    const name = String(record[phoneNumberId] || "").trim();
    return name || undefined;
}
function listPhoneInboxChannels(tenantId, verifiedNameByPhone, connections) {
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
            const metaVerified = lookupVerifiedName(verifiedNameByPhone, phoneNumberId);
            out.push({
                phoneNumberId,
                name: phoneInboxDisplayName(identity, metaVerified),
                displayPhoneNumber: identity.displayPhoneNumber,
                profilePictureUrl: localPhonePhotoUrl(phoneNumberId, identity),
                inboxEnabled: isPhoneInboxEnabled(identity),
                botEnabled: isPhoneBotEnabled(identity),
                inboxEligible: isPhoneInboxEligible(identity, tenantId, connections, phoneNumberId),
                botEligible: isPhoneBotEligible(identity),
            });
        }
        return out;
    }
    catch {
        return [];
    }
}
function listEnabledInboxPhoneIds(tenantId, connections) {
    const id = String(tenantId || "").trim();
    return listPhoneInboxChannels(id, undefined, connections)
        .filter((row) => row.inboxEligible)
        .map((row) => String(row.phoneNumberId || "").trim())
        .filter(Boolean);
}
function markPhoneIdentitiesRestrictedForBusiness(tenantId, businessId, connections) {
    const id = String(tenantId || "").trim();
    const business = String(businessId || "").replace(/\D/g, "");
    if (!id || business.length < 6)
        return 0;
    try {
        const dir = tenantDir(id);
        if (!(0, node_fs_1.existsSync)(dir))
            return 0;
        let count = 0;
        for (const file of (0, node_fs_1.readdirSync)(dir)) {
            if (!file.endsWith(".json"))
                continue;
            const phoneNumberId = file.slice(0, -5);
            const identity = readPhoneIdentity(id, phoneNumberId);
            if (!identity)
                continue;
            const byBusiness = Boolean(identity.businessId && (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(identity.businessId, business));
            const byDisplay = (0, meta_whatsapp_known_owned_wabas_1.knownBusinessIdsForDisplayPhone)(identity.displayPhoneNumber).some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, business));
            const byConnection = (connections || []).some((row) => ((0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), business) ||
                (0, meta_whatsapp_known_owned_wabas_1.knownBusinessIdsForWaba)(String(row.wabaId || "")).some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, business))) &&
                connectionMatchesPhone(row, phoneNumberId, identity));
            if (!byBusiness && !byDisplay && !byConnection)
                continue;
            writePhoneIdentity(id, phoneNumberId, { portfolioHidden: true, businessId: business });
            count += 1;
        }
        return count;
    }
    catch {
        return 0;
    }
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
function inboxQueryPhoneIds(tenantId, connectionPhoneNumberId, selectedPhoneNumberId, connections) {
    const enabled = listEnabledInboxPhoneIds(tenantId, connections);
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
function isInboxPhoneAllowed(tenantId, phoneNumberId, connectionPhoneNumberId, connections) {
    const id = String(phoneNumberId || "").trim();
    if (!id)
        return false;
    const enabled = listEnabledInboxPhoneIds(tenantId, connections);
    if (enabled.includes(id))
        return true;
    const conns = asPhoneIds(connectionPhoneNumberId);
    return enabled.length === 1 && conns.includes(id) && enabled[0] !== id;
}
function resolveInboxSendPhoneNumberId(input) {
    const enabled = listEnabledInboxPhoneIds(input.tenantId, input.connections);
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
function applyLocalPhoneIdentities(tenantId, numbers, placeholderName, options) {
    return numbers.map((row) => {
        const identity = readPhoneIdentity(tenantId, row.phoneNumberId);
        const nameSync = (0, meta_whatsapp_portfolio_map_1.resolvePhoneNameSync)({
            verifiedName: row.verifiedName,
            nameStatus: row.nameStatus,
            newDisplayName: row.newDisplayName,
            newNameStatus: row.newNameStatus,
            localName: identity?.name || null,
            placeholderName,
        });
        if (nameSync.nameSyncStatus === "applied" &&
            (0, meta_whatsapp_portfolio_map_1.namesEqual)(identity?.name, meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME) &&
            row.verifiedName &&
            !(0, meta_whatsapp_portfolio_map_1.namesEqual)(row.verifiedName, meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME)) {
            try {
                writePhoneIdentity(tenantId, row.phoneNumberId, { name: row.verifiedName });
            }
            catch {
                // Identidade local não pode abortar a listagem.
            }
        }
        const uiStatus = (0, meta_whatsapp_portfolio_map_1.resolveMetaPhoneUiStatus)({
            metaStatus: row.metaStatus,
            codeVerificationStatus: row.codeVerificationStatus,
            healthCanSend: row.healthCanSend,
        });
        const localPhoto = localPhonePhotoUrl(row.phoneNumberId, identity);
        const portfolioHidden = options?.hidden === true;
        const businessId = String(options?.businessId || "").replace(/\D/g, "") || null;
        try {
            writePhoneIdentity(tenantId, row.phoneNumberId, {
                uiStatus,
                portfolioHidden,
                ...(businessId ? { businessId } : {}),
            });
        }
        catch {
            // Identidade local não pode abortar a listagem.
        }
        if (isPhoneInboxEnabled(identity) && row.verifiedName) {
            syncInboxChannelNameFromMeta(tenantId, row.phoneNumberId, row.verifiedName, row.displayPhoneNumber);
        }
        const stored = readPhoneIdentity(tenantId, row.phoneNumberId);
        return {
            ...row,
            requestedName: nameSync.requestedName,
            nameSyncStatus: nameSync.nameSyncStatus,
            nameNeedsRegister: nameSync.nameNeedsRegister,
            canActivate: (0, meta_whatsapp_portfolio_map_1.canActivateMetaPhoneNumber)(uiStatus, nameSync.nameNeedsRegister),
            uiStatus,
            profilePictureUrl: localPhoto || row.profilePictureUrl,
            inboxEnabled: isPhoneInboxEnabled(stored),
            botEnabled: isPhoneBotEnabled(stored),
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
