"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickMetaBusinessNode = exports.META_BUSINESS_OWNED_PAGES_FIELDS = exports.META_BUSINESS_PHOTO_FIELDS = exports.META_BUSINESS_PAGE_ID_FIELDS = exports.META_BUSINESS_PAGE_FIELDS = exports.META_BUSINESS_NAME_FIELDS = exports.META_WABA_PAGE_FIELDS = exports.META_WABA_OWNER_FIELDS = exports.META_PORTFOLIO_BUSINESS_IDS = void 0;
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
exports.META_WABA_PAGE_FIELDS = "owner_business_info{id,name,profile_picture_uri,primary_page{id,name,picture}},on_behalf_of_business_info{id,name,profile_picture_uri,primary_page{id,name,picture}}";
exports.META_BUSINESS_NAME_FIELDS = "id,name";
exports.META_BUSINESS_PAGE_FIELDS = "primary_page{id,name,picture}";
exports.META_BUSINESS_PAGE_ID_FIELDS = "primary_page{id}";
exports.META_BUSINESS_PHOTO_FIELDS = "profile_picture_uri";
exports.META_BUSINESS_OWNED_PAGES_FIELDS = "owned_pages.limit(10){id,name,picture}";
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
    let json = res.json;
    let hint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(json);
    if (!hint.primaryPageName) {
        const extra = await getFields(graph, token, id, exports.META_WABA_PAGE_FIELDS);
        if (extra.ok) {
            const mergedJson = { ...asRecord(res.json), ...asRecord(extra.json) };
            const extraHint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(mergedJson);
            if (extraHint.primaryPageName || extraHint.primaryPageId) {
                json = mergedJson;
                hint = extraHint;
            }
        }
    }
    return { hint, json, ok: true };
}
async function mergePrimaryPageFromGraph(graph, token, businessId, card, pageRes) {
    if (pageRes.ok) {
        return (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, business: pageRes.json });
    }
    for (const fields of [exports.META_BUSINESS_PAGE_ID_FIELDS, "primary_page"]) {
        const retry = await getFields(graph, token, businessId, fields);
        if (retry.ok) {
            return (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, business: retry.json });
        }
    }
    return card;
}
async function mergePageEdges(graph, token, businessId, card, photoDownloadUrl) {
    if (card.primaryPageName && (card.profilePictureUrl || photoDownloadUrl)) {
        return { card, photoDownloadUrl };
    }
    let next = card;
    let photo = photoDownloadUrl;
    for (const edge of ["owned_pages", "client_pages", "assigned_pages"]) {
        const pages = await graph({
            token,
            method: "GET",
            path: `${businessId}/${edge}`,
            query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
        });
        if (!pages.ok || !(0, meta_whatsapp_portfolio_map_1.firstOwnedPageId)(pages.json))
            continue;
        next = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: next, ownedPages: pages.json });
        photo = photo || (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(pages.json);
        if (next.primaryPageName && (next.profilePictureUrl || photo))
            break;
    }
    return { card: next, photoDownloadUrl: photo };
}
async function mergeNestedOwnedPages(graph, token, businessId, card, photoDownloadUrl) {
    if (card.primaryPageName)
        return { card, photoDownloadUrl };
    const nested = await getFields(graph, token, businessId, exports.META_BUSINESS_OWNED_PAGES_FIELDS);
    if (!nested.ok)
        return { card, photoDownloadUrl };
    const owned = asRecord(nested.json).owned_pages;
    if (!(0, meta_whatsapp_portfolio_map_1.firstOwnedPageId)(owned))
        return { card, photoDownloadUrl };
    return {
        card: (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, ownedPages: owned }),
        photoDownloadUrl: photoDownloadUrl || (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(owned),
    };
}
async function mergePagesFromUserAccounts(graph, token, businessId, card, photoDownloadUrl) {
    if (card.primaryPageName && (card.profilePictureUrl || photoDownloadUrl)) {
        return { card, photoDownloadUrl };
    }
    const accounts = await graph({
        token,
        method: "GET",
        path: "me/accounts",
        query: { fields: "id,name,picture,business", limit: "50" },
    });
    if (!accounts.ok)
        return { card, photoDownloadUrl };
    const biz = String(businessId || "").trim();
    let matched = null;
    for (const item of (0, meta_whatsapp_portfolio_map_1.listMetaBusinessNodes)(accounts.json)) {
        const rec = asRecord(item);
        if (text(asRecord(rec.business).id) === biz) {
            matched = rec;
            break;
        }
    }
    if (!matched)
        return { card, photoDownloadUrl };
    return {
        card: (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, ownedPages: { data: [matched] } }),
        photoDownloadUrl: photoDownloadUrl || (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(matched),
    };
}
async function fillPageNameById(graph, token, businessId, card) {
    const pageId = String(card.primaryPageId || "").trim();
    if (!pageId || pageId === businessId)
        return card;
    if (card.primaryPageName && card.profilePictureUrl)
        return card;
    const named = await getFields(graph, token, pageId, "id,name,picture");
    if (!named.ok)
        return card;
    const row = asRecord(named.json);
    const pageName = text(row.name);
    const namedId = text(row.id) || pageId;
    if (namedId === businessId)
        return card;
    if (!pageName && !row.picture)
        return card;
    return (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
        fallback: card,
        business: { primary_page: { id: namedId, name: pageName, picture: row.picture } },
    });
}
async function fetchBusinessFromGraph(graph, token, businessId, seen = new Set()) {
    const id = String(businessId || "").trim();
    if (!id || seen.has(id))
        return { card: null, isWaba: false, wabaJson: null, photoDownloadUrl: null };
    seen.add(id);
    const named = await getFields(graph, token, id, exports.META_BUSINESS_NAME_FIELDS);
    const namedRow = asRecord(named.json);
    if (!named.ok || (!text(namedRow.id) && !text(namedRow.name))) {
        return { card: null, isWaba: false, wabaJson: null, photoDownloadUrl: null };
    }
    const [ownerRes, page, photo] = await Promise.all([
        getFields(graph, token, id, exports.META_WABA_OWNER_FIELDS),
        getFields(graph, token, id, exports.META_BUSINESS_PAGE_FIELDS),
        getFields(graph, token, id, exports.META_BUSINESS_PHOTO_FIELDS),
    ]);
    const combined = { ...asRecord(named.json), ...asRecord(ownerRes.ok ? ownerRes.json : null) };
    if (ownerRes.ok && isWabaGraphNode(combined)) {
        let hint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(combined);
        if (!hint.primaryPageName) {
            const extra = await getFields(graph, token, id, exports.META_WABA_PAGE_FIELDS);
            if (extra.ok) {
                const extraHint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)({ ...combined, ...asRecord(extra.json) });
                if (extraHint.primaryPageName || extraHint.primaryPageId)
                    hint = extraHint;
            }
        }
        if (hint.businessId && hint.businessId !== id) {
            const owner = await fetchBusinessFromGraph(graph, token, hint.businessId, seen);
            return {
                card: owner.card
                    ? {
                        ...owner.card,
                        wabaId: hint.wabaId || id,
                        primaryPageId: owner.card.primaryPageId || hint.primaryPageId,
                        primaryPageName: owner.card.primaryPageName || hint.primaryPageName,
                    }
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
                photoDownloadUrl: owner.photoDownloadUrl || (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(ownerRes.json),
            };
        }
    }
    let card = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(named.json, { id });
    card = await mergePrimaryPageFromGraph(graph, token, id, card, page);
    if (photo.ok) {
        card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, business: photo.json });
    }
    let photoDownloadUrl = (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(photo.json) ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(page.json) ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(ownerRes.json) ||
        card.profilePictureUrl;
    const fromEdges = await mergePageEdges(graph, token, id, card, photoDownloadUrl);
    card = fromEdges.card;
    photoDownloadUrl = fromEdges.photoDownloadUrl;
    const fromNested = await mergeNestedOwnedPages(graph, token, id, card, photoDownloadUrl);
    card = fromNested.card;
    photoDownloadUrl = fromNested.photoDownloadUrl;
    const fromAccounts = await mergePagesFromUserAccounts(graph, token, id, card, photoDownloadUrl);
    card = fromAccounts.card;
    photoDownloadUrl = fromAccounts.photoDownloadUrl;
    card = await fillPageNameById(graph, token, id, card);
    if (!card.profilePictureUrl && !photoDownloadUrl) {
        const picture = await graph({
            token,
            method: "GET",
            path: `${id}/picture`,
            query: { redirect: "0", type: "large" },
        });
        if (picture.ok) {
            card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, picture: picture.json });
            photoDownloadUrl = (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(picture.json) || photoDownloadUrl;
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
            photoDownloadUrl = photoDownloadUrl || (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(picture.json);
        }
    }
    return {
        card: { ...card, id: card.id || id },
        isWaba: false,
        wabaJson: null,
        photoDownloadUrl: photoDownloadUrl || card.profilePictureUrl,
    };
}
async function fetchAssignedBusinesses(graph, token) {
    const rich = await graph({
        token,
        method: "GET",
        path: "me/businesses",
        query: { fields: "id,name,profile_picture_uri,picture,primary_page{id,name,picture}", limit: "50" },
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
