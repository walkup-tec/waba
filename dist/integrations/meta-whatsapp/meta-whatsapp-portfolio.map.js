"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_PHONE_NAME_FIELDS = exports.META_PHONE_NUMBER_LIST_FIELDS = void 0;
exports.isMetaPhoneConnected = isMetaPhoneConnected;
exports.namesEqual = namesEqual;
exports.mapPhoneNameFields = mapPhoneNameFields;
exports.resolvePhoneNameSync = resolvePhoneNameSync;
exports.mapMetaBusinessToPortfolio = mapMetaBusinessToPortfolio;
exports.firstOwnedPageId = firstOwnedPageId;
exports.mapMetaPhoneToPortfolioNumber = mapMetaPhoneToPortfolioNumber;
exports.mapMetaPhoneListToPortfolioNumbers = mapMetaPhoneListToPortfolioNumbers;
exports.META_PHONE_NUMBER_LIST_FIELDS = "id,display_phone_number,verified_name,quality_rating,status,code_verification_status,name_status,new_display_name,new_name_status";
exports.META_PHONE_NAME_FIELDS = "verified_name,name_status,new_display_name,new_name_status";
const NAME_READY = new Set(["APPROVED", "AVAILABLE_WITHOUT_REVIEW"]);
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function text(value) {
    const raw = String(value || "").trim();
    return raw || null;
}
function httpsUrl(value) {
    const raw = text(value);
    if (!raw)
        return null;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:")
            return null;
        return parsed.toString();
    }
    catch {
        return null;
    }
}
function pictureUrl(node) {
    const row = asRecord(node);
    const data = asRecord(row.data);
    if (data.is_silhouette === true)
        return null;
    return httpsUrl(data.url) || httpsUrl(row.url);
}
function isMetaPhoneConnected(metaStatus) {
    return String(metaStatus || "").trim().toUpperCase() === "CONNECTED";
}
function namesEqual(left, right) {
    const a = String(left || "").trim().toLowerCase();
    const b = String(right || "").trim().toLowerCase();
    return Boolean(a) && a === b;
}
function mapPhoneNameFields(json) {
    const row = asRecord(json);
    return {
        verifiedName: text(row.verified_name),
        nameStatus: text(row.name_status),
        newDisplayName: text(row.new_display_name),
        newNameStatus: text(row.new_name_status),
    };
}
function resolvePhoneNameSync(input) {
    const verified = text(input.verifiedName);
    const incoming = text(input.newDisplayName) || text(input.localName);
    const newStatus = String(input.newNameStatus || "").trim().toUpperCase();
    if (!incoming && !verified) {
        return { requestedName: null, nameSyncStatus: null, nameNeedsRegister: false };
    }
    if (incoming && namesEqual(incoming, verified)) {
        return { requestedName: null, nameSyncStatus: "applied", nameNeedsRegister: false };
    }
    if (incoming && !namesEqual(incoming, verified)) {
        if (newStatus === "DECLINED") {
            return { requestedName: incoming, nameSyncStatus: "declined", nameNeedsRegister: false };
        }
        if (NAME_READY.has(newStatus)) {
            return { requestedName: incoming, nameSyncStatus: "ready", nameNeedsRegister: true };
        }
        return { requestedName: incoming, nameSyncStatus: "pending", nameNeedsRegister: false };
    }
    return { requestedName: null, nameSyncStatus: verified ? "applied" : null, nameNeedsRegister: false };
}
function mapMetaBusinessToPortfolio(json, fallback) {
    const row = asRecord(json);
    const page = asRecord(row.primary_page);
    return {
        id: text(row.id) || text(fallback.id),
        name: text(row.name),
        primaryPageId: text(page.id),
        primaryPageName: text(page.name),
        profilePictureUrl: httpsUrl(row.profile_picture_uri) || pictureUrl(page.picture),
        wabaId: text(fallback.wabaId),
        connectionId: text(fallback.connectionId),
    };
}
function firstOwnedPageId(json) {
    const data = asRecord(json).data;
    const rows = Array.isArray(data) ? data : [];
    for (const item of rows) {
        const id = text(asRecord(item).id);
        if (id)
            return id;
    }
    return null;
}
function mapMetaPhoneToPortfolioNumber(json, busyPhoneIds = new Set()) {
    const row = asRecord(json);
    const phoneNumberId = text(row.id);
    if (!phoneNumberId)
        return null;
    const metaStatus = text(row.status);
    const connected = isMetaPhoneConnected(metaStatus);
    const busy = busyPhoneIds.has(phoneNumberId);
    const verifiedName = text(row.verified_name);
    const nameStatus = text(row.name_status);
    const newDisplayName = text(row.new_display_name);
    const newNameStatus = text(row.new_name_status);
    const nameSync = resolvePhoneNameSync({
        verifiedName,
        nameStatus,
        newDisplayName,
        newNameStatus,
    });
    return {
        phoneNumberId,
        displayPhoneNumber: text(row.display_phone_number),
        verifiedName,
        qualityRating: text(row.quality_rating),
        metaStatus,
        codeVerificationStatus: text(row.code_verification_status),
        uiStatus: connected ? "ativo" : "pendente",
        dispatchStatus: busy ? "em_disparo" : "livre",
        canActivate: !connected || nameSync.nameNeedsRegister,
        nameNeedsRegister: nameSync.nameNeedsRegister,
        nameStatus,
        newDisplayName,
        newNameStatus,
        profilePictureUrl: null,
        vertical: null,
        description: null,
        address: null,
        email: null,
        requestedName: nameSync.requestedName,
        nameSyncStatus: nameSync.nameSyncStatus,
        photoSyncStatus: null,
        profileSyncStatus: null,
        inboxEnabled: false,
    };
}
function mapMetaPhoneListToPortfolioNumbers(json, busyPhoneIds = new Set()) {
    const data = asRecord(json).data;
    const rows = Array.isArray(data) ? data : [];
    const out = [];
    for (const item of rows) {
        const mapped = mapMetaPhoneToPortfolioNumber(item, busyPhoneIds);
        if (mapped)
            out.push(mapped);
    }
    return out;
}
