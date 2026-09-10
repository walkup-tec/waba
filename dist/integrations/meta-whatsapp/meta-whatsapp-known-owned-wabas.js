"use strict";
/**
 * WABAs owned do BM que o token Embedded Signup da conexão primária
 * costuma omitir (403 / owned seco / debug_token sem a irmã).
 *
 * André - WABA02 não aparece na Conexão se só a WABA01 estiver no fan-out.
 * Rio de Janeiro 01 (client) não entra aqui.
 * Chip só entra no card se a Graph ainda devolver o número; catálogo local
 * não inventa pendente já excluído do Business Manager.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_OWNED_BUSINESS_WABAS = exports.RIO_DE_JANEIRO_01_WABA_ID = exports.ANDRE_WABA02_PENDING_PHONE_ID = exports.ANDRE_WABA02_ID = exports.ANDRE_WABA01_ID = exports.ANDRE_AGUIAR_BUSINESS_IDS = void 0;
exports.normalizeMetaBusinessKey = normalizeMetaBusinessKey;
exports.metaBusinessIdsMatch = metaBusinessIdsMatch;
exports.knownOwnedBusinessesMatch = knownOwnedBusinessesMatch;
exports.knownOwnedCatalogForBusiness = knownOwnedCatalogForBusiness;
exports.knownOwnedWabaIdsForBusiness = knownOwnedWabaIdsForBusiness;
exports.knownOwnedWabaRowsForBusiness = knownOwnedWabaRowsForBusiness;
exports.knownClientWabaIdsForBusiness = knownClientWabaIdsForBusiness;
exports.isKnownClientWabaForBusiness = isKnownClientWabaForBusiness;
exports.knownWabaIdForPendingPhone = knownWabaIdForPendingPhone;
exports.knownWabaNameForId = knownWabaNameForId;
exports.knownPendingPhonesForBusiness = knownPendingPhonesForBusiness;
exports.knownPendingPhoneGraphRow = knownPendingPhoneGraphRow;
exports.ANDRE_AGUIAR_BUSINESS_IDS = [
    "1759044748332124",
    "759044748332124",
    "60843286",
];
exports.ANDRE_WABA01_ID = "2458602464640240";
exports.ANDRE_WABA02_ID = "1744257946809067";
exports.ANDRE_WABA02_PENDING_PHONE_ID = "1311179632078208";
exports.RIO_DE_JANEIRO_01_WABA_ID = "1581808413746453";
exports.KNOWN_OWNED_BUSINESS_WABAS = [
    {
        businessIds: [...exports.ANDRE_AGUIAR_BUSINESS_IDS],
        wabas: [
            { id: exports.ANDRE_WABA01_ID, name: "André - WABA01" },
            { id: exports.ANDRE_WABA02_ID, name: "André - WABA02" },
        ],
        clientWabaIds: [exports.RIO_DE_JANEIRO_01_WABA_ID],
        pendingPhones: [],
    },
];
function normalizeMetaBusinessKey(value) {
    return String(value || "").replace(/\D/g, "");
}
function metaBusinessIdsMatch(left, right) {
    const a = normalizeMetaBusinessKey(left);
    const b = normalizeMetaBusinessKey(right);
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    if (a.length === b.length + 1 && a.startsWith("1") && a.slice(1) === b)
        return true;
    if (b.length === a.length + 1 && b.startsWith("1") && b.slice(1) === a)
        return true;
    return false;
}
/** CNPJ do card (60.843.286) e o id Graph do BM do André são o mesmo portfólio. */
function knownOwnedBusinessesMatch(left, right) {
    if (metaBusinessIdsMatch(left, right))
        return true;
    const a = knownOwnedCatalogForBusiness(left);
    const b = knownOwnedCatalogForBusiness(right);
    return Boolean(a && b && a === b);
}
function knownOwnedCatalogForBusiness(businessId) {
    const wanted = String(businessId || "").trim();
    if (!wanted)
        return null;
    return (exports.KNOWN_OWNED_BUSINESS_WABAS.find((row) => row.businessIds.some((id) => metaBusinessIdsMatch(id, wanted))) || null);
}
function knownOwnedWabaIdsForBusiness(businessId) {
    return (knownOwnedCatalogForBusiness(businessId)?.wabas || []).map((row) => row.id);
}
function knownOwnedWabaRowsForBusiness(businessId) {
    return knownOwnedCatalogForBusiness(businessId)?.wabas.slice() || [];
}
function knownClientWabaIdsForBusiness(businessId) {
    return knownOwnedCatalogForBusiness(businessId)?.clientWabaIds.slice() || [];
}
function isKnownClientWabaForBusiness(businessId, wabaId) {
    const id = String(wabaId || "").trim();
    if (!id)
        return false;
    return knownClientWabaIdsForBusiness(businessId).includes(id);
}
function knownWabaIdForPendingPhone(phoneNumberId) {
    const id = String(phoneNumberId || "").trim();
    if (!id)
        return "";
    for (const catalog of exports.KNOWN_OWNED_BUSINESS_WABAS) {
        const phone = catalog.pendingPhones.find((row) => row.phoneNumberId === id);
        if (phone)
            return phone.wabaId;
    }
    return "";
}
function knownWabaNameForId(wabaId) {
    const id = String(wabaId || "").trim();
    if (!id)
        return "";
    for (const catalog of exports.KNOWN_OWNED_BUSINESS_WABAS) {
        const row = catalog.wabas.find((item) => item.id === id);
        if (row)
            return row.name;
    }
    return "";
}
function knownPendingPhonesForBusiness(businessId) {
    return knownOwnedCatalogForBusiness(businessId)?.pendingPhones.slice() || [];
}
function knownPendingPhoneGraphRow(phone) {
    return {
        id: phone.phoneNumberId,
        display_phone_number: phone.displayPhoneNumber,
        verified_name: phone.verifiedName,
        status: "PENDING",
        code_verification_status: "VERIFIED",
        _portfolio_waba_id: phone.wabaId,
        whatsapp_business_account: { id: phone.wabaId },
    };
}
