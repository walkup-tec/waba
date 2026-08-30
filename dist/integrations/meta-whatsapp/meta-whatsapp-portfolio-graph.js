"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMetaBusinessNode = exports.META_BUSINESS_PHOTO_FIELDS = exports.META_BUSINESS_PAGE_FIELDS = exports.META_BUSINESS_NAME_FIELDS = exports.META_WABA_OWNER_FIELDS = exports.META_PORTFOLIO_BUSINESS_IDS = void 0;
exports.isWabaGraphNode = isWabaGraphNode;
exports.fetchWabaOwner = fetchWabaOwner;
exports.fetchBusinessFromGraph = fetchBusinessFromGraph;
exports.fetchAssignedBusinesses = fetchAssignedBusinesses;
exports.directoryFromAssigned = directoryFromAssigned;
exports.fetchKnownBusinessPortfolios = fetchKnownBusinessPortfolios;
const meta_whatsapp_portfolio_map_1 = require("./meta-whatsapp-portfolio.map");
/** IDs oficiais no Business Manager — só entram no card se a Graph devolver o objeto. */
exports.META_PORTFOLIO_BUSINESS_IDS = [
    "1041827648719609",
    "4141369862822598",
];
exports.META_WABA_OWNER_FIELDS = "id,name,owner_business_info,on_behalf_of_business_info";
exports.META_BUSINESS_NAME_FIELDS = "id,name";
exports.META_BUSINESS_PAGE_FIELDS = "primary_page{id,name}";
exports.META_BUSINESS_PHOTO_FIELDS = "profile_picture_uri";
const emptyHint = {
    wabaId: null,
    wabaName: null,
    businessId: null,
    businessName: null,
    primaryPageId: null,
    primaryPageName: null,
    profilePictureUrl: null,
};
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function text(value) {
    const raw = String(value || "").trim();
    return raw || null;
}
function isWabaGraphNode(json) {
    const hint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(json);
    const nodeId = text(asRecord(json).id);
    return Boolean(hint.businessId && (!nodeId || hint.businessId !== nodeId));
}
async function getFields(graph, token, path, fields) {
    return graph({
        token,
        method: "GET",
        path,
        query: { fields },
    });
}
async function fetchWabaOwner(graph, token, wabaId) {
    const id = String(wabaId || "").trim();
    if (!id)
        return { hint: emptyHint, json: null, ok: false };
    const res = await getFields(graph, token, id, exports.META_WABA_OWNER_FIELDS);
    if (!res.ok)
        return { hint: emptyHint, json: null, ok: false };
    return { hint: (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(res.json), json: res.json, ok: true };
}
async function fetchBusinessFromGraph(graph, token, businessId, seen = new Set()) {
    const id = String(businessId || "").trim();
    if (!id || seen.has(id))
        return { card: null, isWaba: false, wabaJson: null };
    seen.add(id);
    const named = await getFields(graph, token, id, exports.META_BUSINESS_NAME_FIELDS);
    const namedRow = asRecord(named.json);
    if (!named.ok || (!text(namedRow.id) && !text(namedRow.name))) {
        return { card: null, isWaba: false, wabaJson: null };
    }
    const ownerRes = await getFields(graph, token, id, exports.META_WABA_OWNER_FIELDS);
    const combined = { ...asRecord(named.json), ...asRecord(ownerRes.ok ? ownerRes.json : null) };
    if (ownerRes.ok && isWabaGraphNode(combined)) {
        const hint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(combined);
        if (hint.businessId && hint.businessId !== id) {
            const owner = await fetchBusinessFromGraph(graph, token, hint.businessId, seen);
            return {
                card: owner.card
                    ? { ...owner.card, wabaId: hint.wabaId || id }
                    : {
                        id: hint.businessId,
                        name: hint.businessName,
                        primaryPageId: hint.primaryPageId,
                        primaryPageName: hint.primaryPageName,
                        profilePictureUrl: hint.profilePictureUrl,
                        wabaId: hint.wabaId || id,
                    },
                isWaba: true,
                wabaJson: ownerRes.json,
            };
        }
    }
    let card = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(named.json, { id });
    const page = await getFields(graph, token, id, exports.META_BUSINESS_PAGE_FIELDS);
    if (page.ok) {
        card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, business: page.json });
    }
    const photo = await getFields(graph, token, id, exports.META_BUSINESS_PHOTO_FIELDS);
    if (photo.ok) {
        card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, business: photo.json });
    }
    if (!card.primaryPageName) {
        const owned = await graph({
            token,
            method: "GET",
            path: `${id}/owned_pages`,
            query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
        });
        if (owned.ok && (0, meta_whatsapp_portfolio_map_1.firstOwnedPageId)(owned.json)) {
            card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, ownedPages: owned.json });
        }
        else {
            const clients = await graph({
                token,
                method: "GET",
                path: `${id}/client_pages`,
                query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
            });
            if (clients.ok) {
                card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, ownedPages: clients.json });
            }
        }
    }
    if (!card.profilePictureUrl && card.primaryPageId) {
        const picture = await graph({
            token,
            method: "GET",
            path: `${card.primaryPageId}/picture`,
            query: { redirect: "0", type: "large" },
        });
        if (picture.ok) {
            card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, picture: picture.json });
        }
    }
    return { card: { ...card, id: card.id || id }, isWaba: false, wabaJson: null };
}
async function fetchAssignedBusinesses(graph, token) {
    const rich = await graph({
        token,
        method: "GET",
        path: "me/businesses",
        query: { fields: "id,name,profile_picture_uri,primary_page{id,name}", limit: "50" },
    });
    if (rich.ok)
        return rich.json;
    const basic = await graph({
        token,
        method: "GET",
        path: "me/businesses",
        query: { fields: "id,name", limit: "50" },
    });
    return basic.ok ? basic.json : null;
}
function directoryFromAssigned(json) {
    return (0, meta_whatsapp_portfolio_map_1.listMetaBusinessNodes)(json)
        .map((row) => (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(row, {}))
        .filter((biz) => Boolean(biz.id && biz.name));
}
var meta_whatsapp_portfolio_map_2 = require("./meta-whatsapp-portfolio.map");
Object.defineProperty(exports, "pickMetaBusinessNode", { enumerable: true, get: function () { return meta_whatsapp_portfolio_map_2.pickMetaBusinessNode; } });
async function fetchKnownBusinessPortfolios(graph, token) {
    const out = [];
    for (const businessId of exports.META_PORTFOLIO_BUSINESS_IDS) {
        const fetched = await fetchBusinessFromGraph(graph, token, businessId);
        if (fetched.card?.id && fetched.card.name && !fetched.isWaba) {
            out.push(fetched.card);
        }
    }
    return out;
}
