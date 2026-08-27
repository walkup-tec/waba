"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMetaPhoneConnected = isMetaPhoneConnected;
exports.mapMetaBusinessToPortfolio = mapMetaBusinessToPortfolio;
exports.firstOwnedPageId = firstOwnedPageId;
exports.mapMetaPhoneToPortfolioNumber = mapMetaPhoneToPortfolioNumber;
exports.mapMetaPhoneListToPortfolioNumbers = mapMetaPhoneListToPortfolioNumbers;
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
    return {
        phoneNumberId,
        displayPhoneNumber: text(row.display_phone_number),
        verifiedName: text(row.verified_name),
        qualityRating: text(row.quality_rating),
        metaStatus,
        codeVerificationStatus: text(row.code_verification_status),
        uiStatus: connected ? "ativo" : "pendente",
        dispatchStatus: busy ? "em_disparo" : "livre",
        canActivate: !connected,
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
