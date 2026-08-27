"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMetaPhoneConnected = isMetaPhoneConnected;
exports.mapMetaBusinessToPortfolio = mapMetaBusinessToPortfolio;
exports.mapMetaPhoneToPortfolioNumber = mapMetaPhoneToPortfolioNumber;
exports.mapMetaPhoneListToPortfolioNumbers = mapMetaPhoneListToPortfolioNumbers;
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function text(value) {
    const raw = String(value || "").trim();
    return raw || null;
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
        primaryPageName: text(page.name),
        wabaId: text(fallback.wabaId),
    };
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
