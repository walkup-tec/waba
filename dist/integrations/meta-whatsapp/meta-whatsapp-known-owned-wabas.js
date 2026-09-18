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
exports.KNOWN_OWNED_BUSINESS_WABAS = exports.NATALLY_CARISSIA_MUNIZ_BEZERRA_BUSINESS_IDS = exports.FLAVIANE_FERREIRA_TRINDADE_BUSINESS_IDS = exports.MARILZA_DE_CASTRO_BUSINESS_IDS = exports.WALKUP_APP_BUSINESS_IDS = exports.WALKUP_WABA01_ID = exports.WALKUP_BUSINESS_IDS = exports.DRAX_SISTEMAS_DISPLAY_PHONE_DIGITS = exports.DRAX_SISTEMAS_STALE_WABA_ID = exports.DRAX_SISTEMAS_WABA_ID = exports.DRAX_SISTEMAS_BUSINESS_IDS = exports.RIO_DE_JANEIRO_01_WABA_ID = exports.ANDRE_WABA02_PENDING_PHONE_ID = exports.ANDRE_WABA02_ID = exports.ANDRE_WABA01_ID = exports.ANDRE_AGUIAR_BUSINESS_IDS = void 0;
exports.catalogBackfillBusinessIds = catalogBackfillBusinessIds;
exports.catalogBusinessLabel = catalogBusinessLabel;
exports.catalogAgencyBusinessIds = catalogAgencyBusinessIds;
exports.catalogAdminBusinessIds = catalogAdminBusinessIds;
exports.businessIdsToReopenAfterFalseLeftManager = businessIdsToReopenAfterFalseLeftManager;
exports.normalizeMetaBusinessKey = normalizeMetaBusinessKey;
exports.metaBusinessIdsMatch = metaBusinessIdsMatch;
exports.knownOwnedBusinessesMatch = knownOwnedBusinessesMatch;
exports.knownOwnedCatalogForBusiness = knownOwnedCatalogForBusiness;
exports.knownOwnedWabaIdsForBusiness = knownOwnedWabaIdsForBusiness;
exports.equivalentOwnedWabaIdsForBusiness = equivalentOwnedWabaIdsForBusiness;
exports.knownOwnedWabaRowsForBusiness = knownOwnedWabaRowsForBusiness;
exports.knownClientWabaIdsForBusiness = knownClientWabaIdsForBusiness;
exports.isKnownClientWabaForBusiness = isKnownClientWabaForBusiness;
exports.isKnownClientWabaId = isKnownClientWabaId;
exports.knownWabaIdForPendingPhone = knownWabaIdForPendingPhone;
exports.knownBusinessIdsForWaba = knownBusinessIdsForWaba;
exports.knownBusinessIdsForDisplayPhone = knownBusinessIdsForDisplayPhone;
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
exports.DRAX_SISTEMAS_BUSINESS_IDS = ["1041827648719609"];
exports.DRAX_SISTEMAS_WABA_ID = "1636793994538054";
/** Conexão Embedded Signup antiga; a WABA01 do Manager é DRAX_SISTEMAS_WABA_ID. */
exports.DRAX_SISTEMAS_STALE_WABA_ID = "1988957871663919";
/** Chip oficial Drax Sistema — o card em Restritas às vezes vem sem numbers[]. */
exports.DRAX_SISTEMAS_DISPLAY_PHONE_DIGITS = ["5182001279"];
exports.WALKUP_BUSINESS_IDS = ["4141369862822598"];
exports.WALKUP_WABA01_ID = "1014470201624992";
/** Card Grupo Walkup App — WABA gravada no banco já veio misturada (Drax). */
exports.WALKUP_APP_BUSINESS_IDS = ["1247508354180311"];
exports.MARILZA_DE_CASTRO_BUSINESS_IDS = ["4681844838758316"];
exports.FLAVIANE_FERREIRA_TRINDADE_BUSINESS_IDS = ["962298516898955"];
exports.NATALLY_CARISSIA_MUNIZ_BEZERRA_BUSINESS_IDS = ["1832926164812406"];
const CATALOG_ADMIN_BUSINESS_LABELS = {
    "4681844838758316": "60.846.306 Marilza de Castro",
    "962298516898955": "60.845.972 Flaviane Ferreira Trindade",
    "1832926164812406": "52.797.696 Natally Carissia Muniz Bezerra",
};
/** BMs de cliente administrados no laboratório — o me/businesses costuma omitir. */
function catalogBackfillBusinessIds() {
    return [
        ...exports.MARILZA_DE_CASTRO_BUSINESS_IDS,
        ...exports.FLAVIANE_FERREIRA_TRINDADE_BUSINESS_IDS,
        ...exports.NATALLY_CARISSIA_MUNIZ_BEZERRA_BUSINESS_IDS,
    ];
}
/** Nome oficial do BM no Manager, quando a Graph devolve o id sem name. */
function catalogBusinessLabel(businessId) {
    const wanted = String(businessId || "").trim();
    if (!wanted)
        return "";
    for (const [id, name] of Object.entries(CATALOG_ADMIN_BUSINESS_LABELS)) {
        if (metaBusinessIdsMatch(id, wanted))
            return name;
    }
    return "";
}
/** BMs da agência — o Atualizar varre /clients e /owned_businesses destes IDs. */
function catalogAgencyBusinessIds() {
    return [...exports.DRAX_SISTEMAS_BUSINESS_IDS, ...exports.WALKUP_BUSINESS_IDS, ...exports.WALKUP_APP_BUSINESS_IDS];
}
/** BMs que o Manager do laboratório administra — entram na lista se a Graph devolver o objeto. */
function catalogAdminBusinessIds() {
    return [...catalogAgencyBusinessIds(), ...catalogBackfillBusinessIds()];
}
/** Reabrir só estes BMs após o disconnect agressivo por WABA antiga. */
function businessIdsToReopenAfterFalseLeftManager() {
    return catalogAdminBusinessIds();
}
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
    {
        businessIds: [...exports.DRAX_SISTEMAS_BUSINESS_IDS],
        wabas: [{ id: exports.DRAX_SISTEMAS_WABA_ID, name: "Drax Sistemas" }],
        clientWabaIds: [],
        pendingPhones: [],
    },
    {
        businessIds: [...exports.WALKUP_BUSINESS_IDS],
        wabas: [{ id: exports.WALKUP_WABA01_ID, name: "WABA 01" }],
        clientWabaIds: [],
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
const DRAX_SISTER_WABA_IDS = [exports.DRAX_SISTEMAS_WABA_ID, exports.DRAX_SISTEMAS_STALE_WABA_ID];
const ANDRE_SISTER_WABA_IDS = [exports.ANDRE_WABA01_ID, exports.ANDRE_WABA02_ID];
function catalogIsSameBusiness(businessId, catalogBusinessId) {
    return (knownOwnedCatalogForBusiness(businessId) === knownOwnedCatalogForBusiness(catalogBusinessId));
}
/** Ids da mesma conta no card (Manager + conexão stale). Não usar no picker de WABA. */
function equivalentOwnedWabaIdsForBusiness(businessId, storedWabaId) {
    const ids = new Set();
    const stored = String(storedWabaId || "").trim();
    if (stored)
        ids.add(stored);
    for (const id of knownOwnedWabaIdsForBusiness(businessId))
        ids.add(id);
    if (catalogIsSameBusiness(businessId, exports.DRAX_SISTEMAS_BUSINESS_IDS[0]) ||
        DRAX_SISTER_WABA_IDS.includes(stored)) {
        for (const id of DRAX_SISTER_WABA_IDS)
            ids.add(id);
    }
    if (catalogIsSameBusiness(businessId, exports.ANDRE_AGUIAR_BUSINESS_IDS[0]) ||
        ANDRE_SISTER_WABA_IDS.includes(stored)) {
        for (const id of ANDRE_SISTER_WABA_IDS)
            ids.add(id);
    }
    return [...ids].filter(Boolean);
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
/** WABA client de qualquer BM catalogado (ex.: Rio) — não entra no sync de outro portfólio. */
function isKnownClientWabaId(wabaId) {
    const id = String(wabaId || "").trim();
    if (!id)
        return false;
    return exports.KNOWN_OWNED_BUSINESS_WABAS.some((row) => row.clientWabaIds.includes(id));
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
function displayPhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function displayPhonesMatch(left, right) {
    const a = displayPhoneDigits(left);
    const b = displayPhoneDigits(right);
    if (!a || !b)
        return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
}
/** BM catalogado da WABA (inclui irmã stale da Drax). */
function knownBusinessIdsForWaba(wabaId) {
    const id = String(wabaId || "").trim();
    if (!id)
        return [];
    const out = new Set();
    for (const catalog of exports.KNOWN_OWNED_BUSINESS_WABAS) {
        if (catalog.wabas.some((row) => row.id === id) || catalog.clientWabaIds.includes(id)) {
            for (const businessId of catalog.businessIds)
                out.add(businessId);
        }
    }
    if (id === exports.DRAX_SISTEMAS_WABA_ID || id === exports.DRAX_SISTEMAS_STALE_WABA_ID) {
        for (const businessId of exports.DRAX_SISTEMAS_BUSINESS_IDS)
            out.add(businessId);
    }
    if (ANDRE_SISTER_WABA_IDS.includes(id)) {
        for (const businessId of exports.ANDRE_AGUIAR_BUSINESS_IDS)
            out.add(businessId);
    }
    return [...out];
}
/** BM catalogado do número de exibição (ex.: 5182001279 → Drax Sistemas). */
function knownBusinessIdsForDisplayPhone(displayPhoneNumber) {
    const raw = String(displayPhoneNumber || "").trim();
    if (!raw)
        return [];
    const out = new Set();
    if (exports.DRAX_SISTEMAS_DISPLAY_PHONE_DIGITS.some((digits) => displayPhonesMatch(raw, digits))) {
        for (const businessId of exports.DRAX_SISTEMAS_BUSINESS_IDS)
            out.add(businessId);
    }
    for (const catalog of exports.KNOWN_OWNED_BUSINESS_WABAS) {
        if (catalog.pendingPhones.some((row) => displayPhonesMatch(raw, row.displayPhoneNumber))) {
            for (const businessId of catalog.businessIds)
                out.add(businessId);
        }
    }
    return [...out];
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
