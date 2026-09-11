"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappConnectionService = void 0;
exports.toMetaWhatsappUiStatus = toMetaWhatsappUiStatus;
exports.toMetaWhatsappPublicConnection = toMetaWhatsappPublicConnection;
exports.stripMetaSecrets = stripMetaSecrets;
exports.pickConnectionsForWebhookSubscribe = pickConnectionsForWebhookSubscribe;
const meta_config_1 = require("./meta-config");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_oauth_1 = require("./meta-whatsapp-oauth");
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_portfolio_map_1 = require("./meta-whatsapp-portfolio.map");
const meta_whatsapp_template_waba_ids_1 = require("./meta-whatsapp-template-waba-ids");
const meta_whatsapp_portfolio_graph_cache_1 = require("./meta-whatsapp-portfolio-graph-cache");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const meta_whatsapp_graph_errors_1 = require("./meta-whatsapp-graph-errors");
const meta_whatsapp_graph_cooldown_1 = require("./meta-whatsapp-graph-cooldown");
const meta_whatsapp_portfolio_graph_1 = require("./meta-whatsapp-portfolio-graph");
const meta_whatsapp_portfolio_identity_store_1 = require("./meta-whatsapp-portfolio-identity.store");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
const meta_whatsapp_phone_profile_1 = require("./meta-whatsapp-phone-profile");
const meta_whatsapp_resumable_upload_1 = require("./meta-whatsapp-resumable-upload");
const meta_whatsapp_webhook_subscription_service_1 = require("./meta-whatsapp-webhook-subscription.service");
const meta_whatsapp_phone_occupancy_1 = require("./meta-whatsapp-phone-occupancy");
const SENSITIVE_KEY = /^(access_token|accessToken|app_secret|appSecret|client_secret|clientSecret|authorization_code|access_token_encrypted|accessTokenEncrypted|encrypted_token|encryptedToken|system_user_token|systemUserToken|refresh_token|refreshToken)$/i;
function toMetaWhatsappUiStatus(status) {
    if (status === "connected")
        return "conectado";
    if (status === "pending_token" || status === "pending_confirmation")
        return "aguardando_confirmacao";
    if (status === "error" || status === "invalid_token")
        return "erro";
    return "nao_conectado";
}
function toMetaWhatsappPublicConnection(row) {
    if (!row) {
        return {
            connected: false,
            pending: false,
            wabaId: null,
            phoneNumberId: null,
            businessId: null,
            displayPhoneNumber: null,
            verifiedName: null,
            qualityRating: null,
            status: "disconnected",
            uiStatus: "nao_conectado",
        };
    }
    return {
        connected: row.status === "connected",
        pending: row.status === "pending_token" || row.status === "pending_confirmation",
        wabaId: row.wabaId,
        phoneNumberId: row.phoneNumberId,
        businessId: row.metaBusinessId,
        displayPhoneNumber: row.displayPhoneNumber,
        verifiedName: row.verifiedName,
        qualityRating: row.qualityRating,
        status: row.status,
        uiStatus: toMetaWhatsappUiStatus(row.status),
    };
}
function stripMetaSecrets(value) {
    if (Array.isArray(value)) {
        return value.map((item) => stripMetaSecrets(item));
    }
    if (!value || typeof value !== "object")
        return value;
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
        if (SENSITIVE_KEY.test(key))
            continue;
        out[key] = stripMetaSecrets(nested);
    }
    return out;
}
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function requireConfigured() {
    if (!(0, meta_config_1.isMetaTechProviderConfigured)()) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("config_invalid");
    }
}
function withLocalIdentities(tenantId, assets) {
    const localizeCard = (item) => (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioBusinessPhoto)(tenantId, (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioBusinessIdentity)(tenantId, item));
    const busyPhoneIds = (0, meta_whatsapp_phone_occupancy_1.listBusyCloudPhoneNumberIds)(tenantId);
    const localizeNumbers = (numbers, placeholderName) => (0, meta_whatsapp_phone_occupancy_1.applyCloudPhoneOccupancy)(tenantId, (0, meta_whatsapp_phone_identity_store_1.applyLocalPhoneIdentities)(tenantId, numbers, placeholderName), busyPhoneIds);
    const portfolio = assets.portfolio ? localizeCard(assets.portfolio) : null;
    const portfolios = (assets.portfolios || []).map((item) => ({
        ...localizeCard(item),
        numbers: localizeNumbers(item.numbers || [], item.name || item.primaryPageName),
    }));
    return {
        ...assets,
        portfolios,
        selectedConnectionId: assets.selectedConnectionId ?? null,
        portfolio: portfolio,
        numbers: localizeNumbers(assets.numbers || [], assets.portfolio?.name || assets.portfolio?.primaryPageName),
    };
}
function assetsFromPortfolioCards(cards, requested) {
    const selected = cards.find((item) => item.connectionId === requested) ||
        cards.find((item) => item.id && item.id === requested) ||
        cards[0];
    const selectedNumbers = selected?.numbers || [];
    return {
        portfolios: cards,
        selectedConnectionId: selected?.connectionId || null,
        portfolio: selected
            ? {
                id: selected.id,
                name: selected.name,
                primaryPageId: selected.primaryPageId,
                primaryPageName: selected.primaryPageName,
                profilePictureUrl: selected.profilePictureUrl,
                wabaId: selected.wabaId,
                connectionId: selected.connectionId,
            }
            : null,
        numbers: selectedNumbers,
    };
}
function storedNumbersFromConnection(open) {
    const phoneNumberId = String(open.phoneNumberId || "").trim();
    const display = String(open.displayPhoneNumber || "").trim();
    if (!display)
        return [];
    return [
        {
            phoneNumberId: phoneNumberId || display,
            displayPhoneNumber: display || null,
            verifiedName: open.verifiedName,
            qualityRating: open.qualityRating,
            metaStatus: null,
            codeVerificationStatus: null,
            healthCanSend: null,
            uiStatus: open.status === "connected" ? "ativo" : "pendente",
            dispatchStatus: "livre",
            canActivate: open.status !== "connected",
            nameNeedsRegister: false,
            nameStatus: null,
            newDisplayName: null,
            newNameStatus: null,
            profilePictureUrl: null,
            vertical: null,
            description: null,
            address: null,
            email: null,
            requestedName: null,
            nameSyncStatus: null,
            photoSyncStatus: null,
            profileSyncStatus: null,
            inboxEnabled: false,
            wabaId: String(open.wabaId || "").trim() || null,
        },
    ];
}
function cardFromConnection(open) {
    return {
        id: (0, meta_whatsapp_portfolio_map_1.businessIdNotWaba)(open.metaBusinessId, open.wabaId),
        name: null,
        primaryPageId: null,
        primaryPageName: null,
        profilePictureUrl: null,
        wabaId: open.wabaId,
        connectionId: open.id,
        messagingLimit: open.messagingLimit,
    };
}
function collectPortfolioWriteTokens(rows, decrypt) {
    const out = [];
    for (const row of rows) {
        try {
            const token = decrypt(row.accessTokenEncrypted);
            if (!token)
                continue;
            out.push({
                id: row.id,
                token,
                wabaId: String(row.wabaId || "").trim(),
                metaBusinessId: String(row.metaBusinessId || "").trim(),
            });
        }
        catch {
            /* conexão sem token utilizável */
        }
    }
    return out;
}
function tokensForTargetWaba(preferred, targetWabaId, pool, selectedBm) {
    const target = String(targetWabaId || "").trim();
    const out = [];
    const seen = new Set();
    const add = (raw, ownsTarget) => {
        const token = String(raw || "").trim();
        if (!token || seen.has(token))
            return;
        seen.add(token);
        out.push({ token, ownsTarget });
    };
    for (const row of pool) {
        if (target && row.wabaId === target)
            add(row.token, true);
    }
    add(preferred, Boolean(target && pool.some((row) => row.token === preferred && row.wabaId === target)));
    for (const row of pool) {
        if (!selectedBm || !row.metaBusinessId)
            continue;
        if ((0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(row.metaBusinessId, selectedBm) ||
            (0, meta_whatsapp_known_owned_wabas_1.knownOwnedBusinessesMatch)(row.metaBusinessId, selectedBm)) {
            add(row.token, Boolean(target && row.wabaId === target));
        }
    }
    return out;
}
const BUSINESS_PHOTO_TTL_MS = 30 * 1000;
async function cacheGraphBusinessPhoto(tenantId, businessId, url) {
    const id = String(businessId || "").trim();
    const local = id ? (0, meta_whatsapp_portfolio_identity_store_1.localPortfolioBusinessPhotoUrl)(tenantId, id) : null;
    if (process.env.NODE_TEST_CONTEXT) {
        const raw = String(url || "").trim();
        if (!raw || !/^https:\/\//i.test(raw))
            return local;
        try {
            const parsed = new URL(raw);
            if (parsed.searchParams.has("access_token"))
                return local;
            return parsed.toString();
        }
        catch {
            return local;
        }
    }
    if (!id)
        return local;
    if (!(0, meta_whatsapp_portfolio_identity_store_1.shouldRefreshPortfolioBusinessPhoto)(tenantId, id, url, BUSINESS_PHOTO_TTL_MS))
        return local;
    if (!url || !/^https:\/\//i.test(url))
        return local;
    const downloaded = await (0, meta_whatsapp_phone_profile_1.fetchHttpsProfileImage)(url);
    if (!downloaded)
        return local;
    return (0, meta_whatsapp_portfolio_identity_store_1.writePortfolioBusinessPhoto)(tenantId, id, downloaded, url) || local;
}
const HYDRATE_GRAPH = { maxAttempts: 1, timeoutMs: 8000 };
const HYDRATE_PHONE_BUDGET_MS = 18000;
function withHydrateLimits(graph) {
    return (input) => graph({
        ...input,
        maxAttempts: input.maxAttempts ?? HYDRATE_GRAPH.maxAttempts,
        timeoutMs: input.timeoutMs ?? HYDRATE_GRAPH.timeoutMs,
    });
}
async function hydrateOpenConnection(graph, decrypt, tenantId, open, extraWabaIds = [], writeTokens = []) {
    const stored = storedNumbersFromConnection(open);
    const fallback = { ...cardFromConnection(open), numbers: stored };
    let token = "";
    try {
        token = decrypt(open.accessTokenEncrypted);
    }
    catch {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
            tenantId,
            reason: "decrypt",
            connectionId: open.id,
        });
        return { card: fallback, directory: [], connectionId: open.id };
    }
    const g = withHydrateLimits(graph);
    const storedWaba = String(open.wabaId || "").trim();
    const storedBm = String(open.metaBusinessId || "").trim();
    if (!storedWaba && !storedBm) {
        return { card: fallback, directory: [], connectionId: open.id };
    }
    const emptyOwner = {
        hint: {
            wabaId: null,
            wabaName: null,
            businessId: null,
            businessName: null,
            primaryPageId: null,
            primaryPageName: null,
            profilePictureUrl: null,
        },
        json: null,
        ok: false,
        denied: false,
    };
    const waba = storedWaba ? await (0, meta_whatsapp_portfolio_graph_1.fetchWabaOwner)(g, token, storedWaba) : emptyOwner;
    const bmOwner = storedBm && storedBm !== storedWaba
        ? await (0, meta_whatsapp_portfolio_graph_1.fetchWabaOwner)(g, token, storedBm)
        : storedBm
            ? waba
            : emptyOwner;
    const stillHasWaba = waba.ok;
    const stillHasBm = Boolean(storedBm && bmOwner.ok);
    const leftManager = !stillHasWaba && ((storedBm && bmOwner.denied) || (!storedBm && waba.denied));
    if (leftManager) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-left-manager", {
            tenantId,
            reason: "bm-not-administered",
            connectionId: open.id,
            wabaId: storedWaba || null,
            businessId: storedBm || null,
        });
        return {
            card: {
                ...fallback,
                id: "",
                name: null,
                primaryPageId: null,
                primaryPageName: null,
                wabaId: "",
                numbers: [],
            },
            directory: [],
            connectionId: open.id,
            leftManager: true,
        };
    }
    if (waba.denied && stillHasBm) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-stale-waba", {
            tenantId,
            connectionId: open.id,
            wabaId: storedWaba || null,
            businessId: storedBm || null,
        });
    }
    if ((storedWaba && !waba.ok && !waba.denied) || (storedBm && !bmOwner.ok && !bmOwner.denied)) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
            tenantId,
            reason: "waba-identity",
            connectionId: open.id,
        });
    }
    const identity = stillHasWaba ? waba : emptyOwner;
    const hint = identity.hint;
    const resolvedWaba = stillHasWaba
        ? storedWaba ||
            (hint.businessId && hint.wabaId && hint.wabaId !== hint.businessId ? hint.wabaId : "")
        : "";
    const resolvedBm = hint.businessId || (0, meta_whatsapp_portfolio_map_1.businessIdNotWaba)(storedBm, resolvedWaba || storedWaba) || "";
    const [assignedJson, fetchedBm] = await Promise.all([
        (0, meta_whatsapp_portfolio_graph_1.fetchAssignedBusinesses)(g, token),
        resolvedBm
            ? (0, meta_whatsapp_portfolio_graph_1.fetchBusinessFromGraph)(g, token, resolvedBm)
            : Promise.resolve({
                card: null,
                isWaba: false,
                wabaJson: null,
                photoDownloadUrl: null,
            }),
    ]);
    const directory = (0, meta_whatsapp_portfolio_graph_1.directoryFromAssigned)(assignedJson);
    const matched = (0, meta_whatsapp_portfolio_graph_1.pickMetaBusinessNode)(assignedJson, [resolvedBm, hint.businessId, storedBm]);
    let card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
        fallback,
        business: matched,
        waba: identity.json || fetchedBm.wabaJson,
    });
    const graphCard = fetchedBm.card ||
        directory.find((item) => item.id && (item.id === resolvedBm || item.id === hint.businessId)) ||
        null;
    if (graphCard && (graphCard.name || graphCard.primaryPageName || graphCard.profilePictureUrl || graphCard.id)) {
        card = {
            ...card,
            id: graphCard.id || card.id,
            name: graphCard.name || card.name,
            primaryPageId: graphCard.primaryPageId || hint.primaryPageId || card.primaryPageId,
            primaryPageName: graphCard.primaryPageName || hint.primaryPageName || card.primaryPageName,
            profilePictureUrl: graphCard.profilePictureUrl || card.profilePictureUrl,
            wabaId: graphCard.wabaId || card.wabaId || resolvedWaba,
            connectionId: open.id,
        };
    }
    card = {
        ...card,
        primaryPageId: card.primaryPageId || hint.primaryPageId,
        primaryPageName: card.primaryPageName || hint.primaryPageName,
    };
    if (card.primaryPageId && !card.primaryPageName) {
        card = await (0, meta_whatsapp_portfolio_graph_1.fillPageNameById)(g, token, card.id || resolvedBm, card);
    }
    card = (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioBusinessIdentity)(tenantId, card);
    const photoDownloadUrl = fetchedBm.photoDownloadUrl ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(matched) ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(identity.json) ||
        card.profilePictureUrl;
    const localPhoto = await cacheGraphBusinessPhoto(tenantId, card.id, photoDownloadUrl);
    card = {
        ...card,
        profilePictureUrl: localPhoto || card.profilePictureUrl,
        wabaId: card.wabaId || resolvedWaba,
    };
    (0, meta_whatsapp_portfolio_identity_store_1.writePortfolioBusinessIdentity)(tenantId, card);
    const primaryWabaId = resolvedWaba;
    const businessId = String(card.id || resolvedBm || "").trim();
    /**
     * Contas do WhatsApp deste BM = owned ("Propriedade de"). Client (ex.: Rio de Janeiro 01)
     * não entra no card, mesmo se GET owner/on_behalf parecer o BM marcado.
     * WABA irmã (outra conexão do mesmo BM) e debug_token fora do client completam o fan-out
     * quando o token ES 403 no GET da WABA02.
     */
    const wabaIds = new Set();
    const clientIds = new Set();
    if (primaryWabaId)
        wabaIds.add(primaryWabaId);
    for (const id of extraWabaIds) {
        const wid = String(id || "").trim();
        if (wid)
            wabaIds.add(wid);
    }
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaIdsForBusiness)(businessId || storedBm)) {
        const wid = String(id || "").trim();
        if (wid)
            wabaIds.add(wid);
    }
    const phoneRows = [];
    const pushPhones = (rows) => {
        for (const row of rows)
            phoneRows.push(row);
    };
    const nestedFromCustomer = businessId
        ? await collectNestedPhonesFromBusiness(g, token, businessId)
        : { wabaIds: [], clientWabaIds: [], phones: [] };
    const fromThisBm = new Set(nestedFromCustomer.wabaIds);
    for (const id of nestedFromCustomer.clientWabaIds)
        clientIds.add(id);
    if (businessId) {
        for (const id of await listBusinessWabaIds(g, token, businessId, "owned"))
            fromThisBm.add(id);
        for (const id of await listBusinessWabaIds(g, token, businessId, "client"))
            clientIds.add(id);
    }
    for (const id of extraWabaIds) {
        const wid = String(id || "").trim();
        if (wid)
            fromThisBm.add(wid);
    }
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.knownOwnedWabaIdsForBusiness)(businessId || storedBm)) {
        const wid = String(id || "").trim();
        if (wid)
            fromThisBm.add(wid);
    }
    for (const id of fromThisBm)
        wabaIds.add(id);
    pushPhones(nestedFromCustomer.phones);
    const nestedFromMe = await collectNestedPhonesFromMeBusinesses(g, token, businessId);
    for (const id of nestedFromMe.wabaIds) {
        fromThisBm.add(id);
        wabaIds.add(id);
    }
    for (const id of nestedFromMe.clientWabaIds)
        clientIds.add(id);
    pushPhones(nestedFromMe.phones);
    const debugTargets = await listDebugTokenWhatsappTargets(g, token);
    const debugPhoneNodes = await fetchPhoneNodes(g, token, debugTargets.phoneIds);
    pushPhones(debugPhoneNodes);
    if (businessId) {
        const unknownWabas = new Set();
        for (const id of debugTargets.wabaIds) {
            if ((0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(businessId, id)) {
                clientIds.add(id);
                continue;
            }
            if (id && !wabaIds.has(id) && !clientIds.has(id))
                unknownWabas.add(id);
        }
        for (const row of debugPhoneNodes) {
            const rec = row && typeof row === "object" ? row : {};
            const account = rec.whatsapp_business_account;
            const accountId = account && typeof account === "object"
                ? String(account.id || "").trim()
                : "";
            const stamped = String(rec._portfolio_waba_id || "").trim();
            const wid = accountId || stamped;
            if (wid && !wabaIds.has(wid) && !clientIds.has(wid))
                unknownWabas.add(wid);
        }
        if (unknownWabas.size) {
            const owned = await (0, meta_whatsapp_template_waba_ids_1.filterWabaIdsOwnedByBusiness)({
                token,
                businessId,
                ids: [...unknownWabas],
                keepOnErrorIds: [...unknownWabas],
                graph: (input) => g({
                    ...input,
                    method: input.method === "DELETE" ? "GET" : input.method,
                }),
            });
            for (const row of owned) {
                fromThisBm.add(row.id);
                wabaIds.add(row.id);
            }
        }
    }
    else {
        for (const id of debugTargets.wabaIds)
            wabaIds.add(id);
    }
    let anyPhonesOk = phoneRows.length > 0;
    let lastPhoneStatus = 0;
    const listedOkWabaIds = new Set();
    const extraWabas = [...wabaIds].filter((id) => id && id !== primaryWabaId);
    const orderedWabas = [primaryWabaId, ...extraWabas].filter(Boolean);
    const startedAt = Date.now();
    for (const wid of orderedWabas) {
        if (Date.now() - startedAt >= HYDRATE_PHONE_BUDGET_MS && phoneRows.length) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-hydrate-budget", {
                tenantId,
                connectionId: open.id,
                wabaId: wid,
                listed: phoneRows.length,
            });
            break;
        }
        const phones = await listWabaPhoneNumbersForPortfolio(g, wid, token, writeTokens, String(open.metaBusinessId || businessId || storedBm || "").trim());
        if (!phones.ok) {
            lastPhoneStatus = phones.status;
            continue;
        }
        anyPhonesOk = true;
        listedOkWabaIds.add(wid);
        pushPhones(stampPhoneRowsWithWabaId(phones.json.data, wid));
    }
    if (!anyPhonesOk) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
            tenantId,
            reason: "phones",
            status: lastPhoneStatus,
            connectionId: open.id,
            wabaCount: wabaIds.size,
        });
        return {
            card: {
                ...card,
                numbers: stored,
            },
            directory,
            connectionId: open.id,
        };
    }
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-fanout", {
        tenantId,
        connectionId: open.id,
        businessId: businessId || null,
        wabaCount: wabaIds.size,
        phoneRowCount: phoneRows.length,
    });
    const mapped = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)({ data: phoneRows });
    let merged = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(mapped, stored);
    const claimedPhoneId = String(open.phoneNumberId || "").trim();
    if (claimedPhoneId && !merged.some((row) => String(row.phoneNumberId || "").trim() === claimedPhoneId)) {
        const extra = await fetchPhoneNodes(g, [token, ...writeTokens.map((row) => row.token)], [claimedPhoneId], primaryWabaId);
        merged = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(merged, (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)({ data: extra }));
    }
    const knownPending = (0, meta_whatsapp_known_owned_wabas_1.knownPendingPhonesForBusiness)(businessId || storedBm);
    const missingKnownIds = knownPending
        .map((row) => row.phoneNumberId)
        .filter((id) => {
        if (!id)
            return false;
        if (merged.some((row) => String(row.phoneNumberId || "").trim() === id))
            return false;
        const wabaId = (0, meta_whatsapp_known_owned_wabas_1.knownWabaIdForPendingPhone)(id);
        if (wabaId && listedOkWabaIds.has(wabaId))
            return false;
        return true;
    });
    if (missingKnownIds.length) {
        const extra = await fetchPhoneNodes(g, token, missingKnownIds);
        merged = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(merged, (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)({ data: extra }));
    }
    const pending = merged.filter((row) => row.uiStatus !== "ativo");
    const active = merged.filter((row) => row.uiStatus === "ativo");
    const withProfiles = active.length
        ? await attachPhoneBusinessProfiles(g, token, active, tenantId, card.name)
        : [];
    let numbers = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(withProfiles, pending);
    if (fromThisBm.size) {
        numbers = numbers.filter((row) => {
            const id = String(row.phoneNumberId || "").trim();
            if (claimedPhoneId && id === claimedPhoneId)
                return true;
            const wid = String(row.wabaId || "").trim();
            if (!wid)
                return Boolean(String(row.displayPhoneNumber || "").trim());
            return wabaIds.has(wid);
        });
    }
    return {
        card: {
            ...card,
            wabaId: card.wabaId || primaryWabaId || "",
            messagingLimit: open.messagingLimit || card.messagingLimit || null,
            numbers,
        },
        directory,
        connectionId: open.id,
    };
}
/** WABAs (management) e chips (messaging) liberados no token — Embedded Signup manage-accounts. */
async function listDebugTokenWhatsappTargets(graph, userToken) {
    const appId = (0, meta_config_1.readMetaAppId)();
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    if (!appId || !appSecret || !userToken)
        return { wabaIds: [], phoneIds: [] };
    const res = await graph({
        token: `${appId}|${appSecret}`,
        method: "GET",
        path: "debug_token",
        query: { input_token: userToken },
    });
    if (!res.ok)
        return { wabaIds: [], phoneIds: [] };
    const payload = (res.json && typeof res.json === "object" ? res.json : {});
    const granular = Array.isArray(payload.data?.granular_scopes) ? payload.data.granular_scopes : [];
    const wabaIds = new Set();
    const phoneIds = new Set();
    for (const entry of granular) {
        const scope = String(entry?.scope || "").trim();
        const targets = Array.isArray(entry?.target_ids) ? entry.target_ids : [];
        for (const raw of targets) {
            const id = String(raw || "").trim();
            if (!id)
                continue;
            if (scope === "whatsapp_business_management")
                wabaIds.add(id);
            else if (scope === "whatsapp_business_messaging")
                phoneIds.add(id);
        }
    }
    return { wabaIds: [...wabaIds], phoneIds: [...phoneIds] };
}
async function fetchPhoneNodes(graph, token, phoneIds, stampWabaId) {
    const tokens = [...new Set((Array.isArray(token) ? token : [token]).map((item) => String(item || "").trim()).filter(Boolean))];
    const out = [];
    const fallbackWaba = String(stampWabaId || "").trim();
    for (const id of phoneIds) {
        let res = null;
        for (const item of tokens) {
            const attempt = await graph({
                token: item,
                method: "GET",
                path: id,
                query: { fields: `${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS},whatsapp_business_account` },
            });
            if (attempt.ok && attempt.json && typeof attempt.json === "object") {
                res = attempt;
                break;
            }
        }
        if (!res || !res.ok || !res.json || typeof res.json !== "object")
            continue;
        const display = String(res.json.display_phone_number || "").trim();
        if (!display)
            continue;
        const row = res.json;
        const account = row.whatsapp_business_account;
        const accountId = account && typeof account === "object"
            ? String(account.id || "").trim()
            : "";
        out.push(fallbackWaba || accountId
            ? { ...row, _portfolio_waba_id: accountId || fallbackWaba }
            : row);
    }
    return out;
}
function extractWabasAndPhonesFromBusinessNode(node) {
    const row = node && typeof node === "object" ? node : {};
    const ownedIds = new Set();
    const clientIds = new Set();
    const phones = [];
    const takeEdge = (edge, into, takePhones) => {
        const bucket = row[edge];
        const data = bucket && typeof bucket === "object" ? bucket.data : null;
        const list = Array.isArray(data) ? data : [];
        for (const waba of list) {
            const wabaRow = waba && typeof waba === "object" ? waba : {};
            const wid = String(wabaRow.id || "").trim();
            if (wid)
                into.add(wid);
            if (!takePhones)
                continue;
            const phoneBucket = wabaRow.phone_numbers;
            const phoneData = phoneBucket && typeof phoneBucket === "object"
                ? phoneBucket.data
                : null;
            if (Array.isArray(phoneData)) {
                for (const phone of stampPhoneRowsWithWabaId(phoneData, wid))
                    phones.push(phone);
            }
        }
    };
    takeEdge("owned_whatsapp_business_accounts", ownedIds, true);
    takeEdge("client_whatsapp_business_accounts", clientIds, false);
    return { wabaIds: [...ownedIds], clientWabaIds: [...clientIds], phones };
}
async function collectNestedPhonesFromBusiness(graph, token, businessId) {
    const bm = String(businessId || "").trim();
    if (!bm)
        return { wabaIds: [], clientWabaIds: [], phones: [] };
    const fields = [
        "id",
        "name",
        `owned_whatsapp_business_accounts{id,name,phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
        `client_whatsapp_business_accounts{id,name}`,
    ].join(",");
    const res = await graph({
        token,
        method: "GET",
        path: bm,
        query: { fields },
    });
    if (!res.ok)
        return { wabaIds: [], clientWabaIds: [], phones: [] };
    return extractWabasAndPhonesFromBusinessNode(res.json);
}
async function collectNestedPhonesFromMeBusinesses(graph, token, onlyBusinessId) {
    const fields = [
        "id",
        "name",
        `owned_whatsapp_business_accounts{id,name,phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
        `client_whatsapp_business_accounts{id,name}`,
    ].join(",");
    const res = await graph({
        token,
        method: "GET",
        path: "me/businesses",
        query: { fields, limit: "50" },
    });
    if (!res.ok)
        return { wabaIds: [], clientWabaIds: [], phones: [] };
    const data = Array.isArray(res.json?.data) ? res.json.data : [];
    const only = String(onlyBusinessId || "").trim();
    const wabaIds = new Set();
    const clientWabaIds = new Set();
    const phones = [];
    for (const node of data) {
        const nodeId = String((node && typeof node === "object" ? node.id : "") || "").trim();
        if (only && nodeId !== only)
            continue;
        const extracted = extractWabasAndPhonesFromBusinessNode(node);
        for (const id of extracted.wabaIds)
            wabaIds.add(id);
        for (const id of extracted.clientWabaIds)
            clientWabaIds.add(id);
        for (const phone of extracted.phones)
            phones.push(phone);
    }
    return { wabaIds: [...wabaIds], clientWabaIds: [...clientWabaIds], phones };
}
/**
 * Lista WABA IDs de um Business Manager (owned = Propriedade de; client = compartilhada).
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/
 * @see https://developers.facebook.com/docs/marketing-api/reference/business/
 */
async function listBusinessWabaIds(graph, token, businessId, edge = "owned") {
    const bm = String(businessId || "").trim();
    if (!bm)
        return [];
    const pathEdge = edge === "client" ? "client_whatsapp_business_accounts" : "owned_whatsapp_business_accounts";
    const ids = new Set();
    const seen = new Set();
    let after = "";
    for (let page = 0; page < 20; page += 1) {
        const query = {
            fields: "id,name",
            limit: "100",
        };
        if (after)
            query.after = after;
        const res = await graph({
            token,
            method: "GET",
            path: `${bm}/${pathEdge}`,
            query,
        });
        if (!res.ok)
            break;
        const batch = Array.isArray(res.json?.data) ? res.json.data : [];
        for (const row of batch) {
            const id = String(row?.id || "").trim();
            if (id)
                ids.add(id);
        }
        const nextAfter = String(res.json?.paging?.cursors?.after || "").trim();
        if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length)
            break;
        seen.add(nextAfter);
        after = nextAfter;
    }
    return [...ids];
}
async function listWabaPhoneNumbersPagedWithFields(graph, token, wabaId, fields) {
    const data = [];
    const seen = new Set();
    let after = "";
    for (let page = 0; page < 20; page += 1) {
        const query = {
            limit: "100",
        };
        if (fields)
            query.fields = fields;
        if (after)
            query.after = after;
        const phones = await graph({
            token,
            method: "GET",
            path: `${wabaId}/phone_numbers`,
            query,
        });
        if (!phones.ok) {
            if (!data.length)
                return { ok: false, status: phones.status };
            break;
        }
        const batch = Array.isArray(phones.json?.data) ? phones.json.data : [];
        for (const row of batch)
            data.push(row);
        const nextAfter = String(phones.json?.paging?.cursors?.after || "").trim();
        if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length)
            break;
        seen.add(nextAfter);
        after = nextAfter;
    }
    return { ok: true, json: { data } };
}
/** Graph `/{wabaId}/phone_numbers` não devolve waba_id; o Disparo Cloud agrupa pelo campo no chip. */
function stampPhoneRowsWithWabaId(rows, wabaId) {
    const wid = String(wabaId || "").trim();
    if (!wid)
        return rows;
    return rows.map((row) => {
        if (!row || typeof row !== "object")
            return row;
        return { ...row, _portfolio_waba_id: wid };
    });
}
function mergePhoneNumberRows(...lists) {
    const byId = new Map();
    for (const list of lists) {
        for (const row of list) {
            if (!row || typeof row !== "object")
                continue;
            const rec = row;
            const id = String(rec.id || "").trim();
            if (!id)
                continue;
            const prev = byId.get(id) || {};
            byId.set(id, { ...prev, ...rec, id });
        }
    }
    return [...byId.values()];
}
/** Lista todos os chips do WABA. Une catálogo (Pendente) com health/tier/nome dos Ativos. */
async function listWabaPhoneNumbersPaged(graph, token, wabaId) {
    const [defaults, catalog, withLimit] = await Promise.all([
        listWabaPhoneNumbersPagedWithFields(graph, token, wabaId),
        listWabaPhoneNumbersPagedWithFields(graph, token, wabaId, meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS),
        listWabaPhoneNumbersPagedWithFields(graph, token, wabaId, meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_LIST_FIELDS_WITH_LIMIT),
    ]);
    const merged = mergePhoneNumberRows(defaults.ok ? defaults.json.data : [], catalog.ok ? catalog.json.data : [], withLimit.ok ? withLimit.json.data : []);
    if (merged.length)
        return { ok: true, json: { data: merged } };
    if (catalog.ok)
        return catalog;
    if (defaults.ok)
        return defaults;
    return withLimit;
}
async function listWabaPhoneNumbersForPortfolio(graph, wabaId, preferredToken, pool, selectedBm) {
    const ordered = tokensForTargetWaba(preferredToken, wabaId, pool, selectedBm);
    let emptyOk = null;
    let lastFail = { ok: false, status: 0 };
    for (const item of ordered) {
        const phones = await listWabaPhoneNumbersPaged(graph, item.token, wabaId);
        if (phones.ok && phones.json.data.length)
            return phones;
        if (phones.ok) {
            emptyOk = phones;
            if (item.ownsTarget)
                return phones;
            continue;
        }
        lastFail = phones;
    }
    return emptyOk || lastFail;
}
async function cacheGraphPhonePhoto(tenantId, phoneNumberId, url) {
    const identity = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenantId, phoneNumberId);
    const local = (0, meta_whatsapp_phone_identity_store_1.localPhonePhotoUrl)(phoneNumberId, identity);
    if (process.env.NODE_TEST_CONTEXT)
        return local;
    if (!url || !/^https:\/\//i.test(url))
        return local;
    if (!(0, meta_whatsapp_portfolio_map_1.shouldRefreshCachedPhonePhoto)(identity, url)) {
        return local;
    }
    const downloaded = await (0, meta_whatsapp_phone_profile_1.fetchHttpsProfileImage)(url);
    if (!downloaded)
        return local;
    const saved = (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenantId, phoneNumberId, {
        photo: downloaded,
        photoSource: (0, meta_whatsapp_portfolio_map_1.graphPhotoSourceKey)(url),
        photoMetaApplied: true,
    });
    return (0, meta_whatsapp_phone_identity_store_1.localPhonePhotoUrl)(phoneNumberId, saved) || local;
}
async function attachPhoneBusinessProfiles(graph, token, numbers, tenantId, placeholderName) {
    if (!numbers.length)
        return numbers;
    const limited = numbers.slice(0, 20);
    const rest = numbers.slice(20);
    const withProfiles = await Promise.all(limited.map(async (row) => {
        const [nameNode, profile] = await Promise.all([
            graph({
                token,
                method: "GET",
                path: row.phoneNumberId,
                query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NAME_FIELDS },
            }),
            graph({
                token,
                method: "GET",
                path: `${row.phoneNumberId}/whatsapp_business_profile`,
                query: { fields: "about,address,description,email,profile_picture_url,vertical" },
            }),
        ]);
        const named = nameNode.ok ? (0, meta_whatsapp_portfolio_map_1.mapPhoneNameFields)(nameNode.json) : {
            verifiedName: null,
            nameStatus: null,
            newDisplayName: null,
            newNameStatus: null,
        };
        const verifiedName = named.verifiedName || row.verifiedName;
        const nameStatus = named.nameStatus || row.nameStatus;
        const newDisplayName = named.newDisplayName || row.newDisplayName;
        const newNameStatus = named.newNameStatus || row.newNameStatus;
        const nameSync = (0, meta_whatsapp_portfolio_map_1.resolvePhoneNameSync)({
            verifiedName,
            nameStatus,
            newDisplayName,
            newNameStatus,
            placeholderName,
        });
        const mapped = profile.ok ? (0, meta_whatsapp_phone_profile_1.mapWhatsappBusinessProfile)(profile.json) : null;
        const localPhoto = await cacheGraphPhonePhoto(tenantId, row.phoneNumberId, mapped?.profilePictureUrl || null);
        return {
            ...row,
            verifiedName,
            nameStatus,
            newDisplayName,
            newNameStatus,
            requestedName: nameSync.requestedName,
            nameSyncStatus: nameSync.nameSyncStatus,
            nameNeedsRegister: nameSync.nameNeedsRegister,
            canActivate: (0, meta_whatsapp_portfolio_map_1.canActivateMetaPhoneNumber)((0, meta_whatsapp_portfolio_map_1.resolveMetaPhoneUiStatus)({
                metaStatus: row.metaStatus,
                codeVerificationStatus: row.codeVerificationStatus,
                healthCanSend: row.healthCanSend,
            }), nameSync.nameNeedsRegister),
            profilePictureUrl: localPhoto || (0, meta_whatsapp_portfolio_map_1.safePublicPhotoUrl)(mapped?.profilePictureUrl),
            vertical: mapped?.vertical ?? row.vertical,
            description: mapped?.description ?? row.description,
            address: mapped?.address ?? row.address,
            email: mapped?.email ?? row.email,
        };
    }));
    return rest.length ? withProfiles.concat(rest) : withProfiles;
}
function wabaIdFromPhoneJson(json) {
    const row = json && typeof json === "object" ? json : {};
    const nested = row.whatsapp_business_account;
    if (nested && typeof nested === "object") {
        return String(nested.id || "").trim();
    }
    return "";
}
/** Uma conexão elegível por WABA (preferred connectionId / phoneNumberId primeiro). */
function pickConnectionsForWebhookSubscribe(open, opts) {
    const preferredId = String(opts?.connectionId || "").trim();
    const phone = String(opts?.phoneNumberId || "").trim();
    const eligible = open.filter((row) => {
        if (row.disconnectedAt)
            return false;
        if (!String(row.wabaId || "").trim())
            return false;
        return row.status === "connected" || row.status === "pending_confirmation";
    });
    const score = (row) => {
        let n = 0;
        if (preferredId && row.id === preferredId)
            n += 2;
        if (phone && String(row.phoneNumberId || "").trim() === phone)
            n += 1;
        return n;
    };
    const sorted = [...eligible].sort((a, b) => score(b) - score(a) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const seen = new Set();
    const out = [];
    for (const row of sorted) {
        const waba = String(row.wabaId || "").trim();
        if (seen.has(waba))
            continue;
        seen.add(waba);
        out.push(row);
    }
    return out;
}
function rememberOfficialPhoneDisplayName(tenantId, phoneNumberId) {
    const id = String(phoneNumberId || "").trim();
    if (!id)
        return;
    try {
        (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenantId, id, {
            name: meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME,
            channelName: meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME,
        });
    }
    catch {
        // Identidade local não pode abortar o cadastro do número.
    }
}
async function requestOfficialPhoneDisplayName(graph, input) {
    rememberOfficialPhoneDisplayName(input.tenantId, input.phoneNumberId);
    if ((0, meta_whatsapp_portfolio_map_1.namesEqual)(input.currentVerifiedName, meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME))
        return;
    const renamed = await graph({
        token: input.token,
        method: "POST",
        path: input.phoneNumberId,
        query: { new_display_name: meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME },
    });
    if (!renamed.ok) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-failed", {
            tenantId: input.tenantId,
            status: renamed.status,
            graphCode: renamed.graphCode,
        });
        return;
    }
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-requested", { tenantId: input.tenantId });
}
class MetaWhatsappConnectionService {
    constructor(repository = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), oauth = { exchangeEmbeddedSignupCode: meta_whatsapp_oauth_1.exchangeEmbeddedSignupCode }, graph = (input) => (0, meta_whatsapp_graph_client_1.callMetaGraphJson)(input), decrypt = meta_token_crypto_1.decryptMetaToken, uploadImage = meta_whatsapp_resumable_upload_1.uploadMetaResumableImage, setPagePicture = meta_whatsapp_resumable_upload_1.publishMetaPageProfilePicture, webhookSubscriptions = new meta_whatsapp_webhook_subscription_service_1.MetaWhatsappWebhookSubscriptionService()) {
        this.repository = repository;
        this.oauth = oauth;
        this.graph = graph;
        this.decrypt = decrypt;
        this.uploadImage = uploadImage;
        this.setPagePicture = setPagePicture;
        this.webhookSubscriptions = webhookSubscriptions;
    }
    startAuthenticatedFlow(auth) {
        const tenant = requireTenant(auth);
        requireConfigured();
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("start", { tenantId: tenant.tenantId });
        return {
            ok: true,
            appId: (0, meta_config_1.readMetaAppId)(),
            configId: (0, meta_config_1.readMetaConfigId)(),
            graphVersion: (0, meta_config_1.readMetaJsSdkGraphVersion)(),
            callbackPath: "/integrations/meta/whatsapp/callback",
        };
    }
    async getPublicStatus(auth) {
        const tenant = requireTenant(auth);
        const row = await this.repository.findOpenByTenant(tenant.tenantId);
        return toMetaWhatsappPublicConnection(row);
    }
    async disconnectOfficialLabFromAuth(auth) {
        const tenant = requireTenant(auth);
        const repo = this.repository;
        if (typeof repo.disconnectOpenByTenant !== "function") {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        const disconnected = await repo.disconnectOpenByTenant(tenant.tenantId, tenant.ownerEmail);
        (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        (0, meta_whatsapp_portfolio_identity_store_1.purgePortfolioIdentity)(tenant.tenantId);
        (0, meta_whatsapp_phone_identity_store_1.purgePhoneIdentities)(tenant.tenantId);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-disconnected", {
            tenantId: tenant.tenantId,
            disconnected,
        });
        return {
            disconnected,
            portfolios: [],
            selectedConnectionId: null,
            portfolio: null,
            numbers: [],
        };
    }
    async exchangeCodeAndStore(auth, input) {
        const tenant = requireTenant(auth);
        requireConfigured();
        const code = String(input.code || "").trim();
        if (!code) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("code_missing");
        }
        if (input.tenantId || input.ownerEmail) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("ignored-client-tenant", { tenantId: tenant.tenantId });
        }
        let exchanged;
        try {
            exchanged = await this.oauth.exchangeEmbeddedSignupCode({
                code,
                redirectUri: input.redirectUri,
            });
        }
        catch (error) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("exchange-failed", {
                tenantId: tenant.tenantId,
                status: Number(error?.status) || 0,
            });
            const msg = String(error?.message || "");
            if (/access_token|invalid.?token/i.test(msg)) {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            }
            throw new meta_whatsapp_errors_1.MetaWhatsappError("exchange_failed");
        }
        let encrypted;
        try {
            encrypted = (0, meta_token_crypto_1.encryptMetaToken)(exchanged.accessToken);
        }
        catch (error) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("encrypt-failed", {
                tenantId: tenant.tenantId,
                crypto: error instanceof meta_token_crypto_1.MetaTokenCryptoError,
            });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        try {
            const row = await this.repository.upsertPendingToken({
                tenantId: tenant.tenantId,
                ownerEmail: tenant.ownerEmail,
                accessTokenEncrypted: encrypted,
                tokenType: exchanged.tokenType,
                tokenExpiresAt: (0, meta_whatsapp_oauth_1.metaOauthExpiresAt)(exchanged.expiresIn),
                configId: (0, meta_config_1.readMetaConfigId)() || null,
                metaBusinessId: null,
                actorEmail: tenant.ownerEmail,
            });
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("token-stored", {
                tenantId: tenant.tenantId,
                status: row.status,
                connectionId: row.id,
            });
            return toMetaWhatsappPublicConnection(row);
        }
        catch (error) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("persist-failed", { tenantId: tenant.tenantId });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
    }
    async attachSessionAssets(auth, input) {
        const tenant = requireTenant(auth);
        if (input.tenantId || input.ownerEmail) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("ignored-client-tenant", { tenantId: tenant.tenantId });
        }
        const incomingBusinessId = String(input.businessId || "").trim();
        const pendingToken = await this.repository.latestPendingToken(tenant.tenantId);
        const byBusiness = incomingBusinessId
            ? await this.repository.findByBusinessId(tenant.tenantId, incomingBusinessId)
            : null;
        const mergeIntoConnected = Boolean(byBusiness &&
            byBusiness.status === "connected" &&
            pendingToken &&
            pendingToken.id !== byBusiness.id);
        const open = mergeIntoConnected && byBusiness ? byBusiness : pendingToken || byBusiness;
        if (!open) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        }
        const wabaId = String(input.wabaId || open.wabaId || "").trim();
        const phoneNumberId = String(input.phoneNumberId || open.phoneNumberId || "").trim();
        const businessId = String(input.businessId || open.metaBusinessId || "").trim();
        if (!wabaId && !phoneNumberId && !businessId) {
            return toMetaWhatsappPublicConnection(open);
        }
        try {
            const row = await this.repository.attachClaimedAssets(tenant.tenantId, open.id, {
                wabaId: wabaId || null,
                phoneNumberId: phoneNumberId || null,
                metaBusinessId: businessId || null,
                displayPhoneNumber: input.displayPhoneNumber || open.displayPhoneNumber,
                verifiedName: input.verifiedName || open.verifiedName,
                accessTokenEncrypted: mergeIntoConnected ? pendingToken?.accessTokenEncrypted || null : null,
                tokenType: mergeIntoConnected ? pendingToken?.tokenType || null : null,
                tokenExpiresAt: mergeIntoConnected ? pendingToken?.tokenExpiresAt || null : null,
                actorEmail: tenant.ownerEmail,
            });
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("assets-claimed", {
                tenantId: tenant.tenantId,
                connectionId: row.id,
                hasWaba: Boolean(row.wabaId),
                hasPhone: Boolean(row.phoneNumberId),
                hasBusiness: Boolean(row.metaBusinessId),
                status: row.status,
            });
            const repo = this.repository;
            if (typeof repo.disconnectEmptyPendingTokens === "function") {
                await repo.disconnectEmptyPendingTokens(tenant.tenantId, tenant.ownerEmail, row.id);
            }
            if (phoneNumberId) {
                rememberOfficialPhoneDisplayName(tenant.tenantId, phoneNumberId);
            }
            (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
            return toMetaWhatsappPublicConnection(row);
        }
        catch {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
    }
    /**
     * Só marca connected após Graph confirmar WABA + Phone Number da mesma conta.
     */
    async confirmFromAuth(auth) {
        const tenant = requireTenant(auth);
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        if (open.status === "connected")
            return toMetaWhatsappPublicConnection(open);
        const wabaId = String(open.wabaId || "").trim();
        const phoneNumberId = String(open.phoneNumberId || "").trim();
        if (!wabaId || !phoneNumberId) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-skip", {
                tenantId: tenant.tenantId,
                reason: "missing_assets",
                hasWaba: Boolean(wabaId),
                hasPhone: Boolean(phoneNumberId),
            });
            return toMetaWhatsappPublicConnection(open);
        }
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const waba = await this.graph({
            token,
            method: "GET",
            path: wabaId,
            query: { fields: "id" },
        });
        if (!waba.ok) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-failed", {
                tenantId: tenant.tenantId,
                reason: "waba",
                status: waba.status,
            });
            if (waba.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        const phoneFields = {
            fields: "id,display_phone_number,verified_name,quality_rating,whatsapp_business_account",
        };
        let phone = await this.graph({
            token,
            method: "GET",
            path: phoneNumberId,
            query: phoneFields,
        });
        const retries = process.env.NODE_TEST_CONTEXT ? 0 : 2;
        for (let attempt = 0; !phone.ok && phone.status !== 401 && attempt < retries; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            phone = await this.graph({
                token,
                method: "GET",
                path: phoneNumberId,
                query: phoneFields,
            });
        }
        if (!phone.ok) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-failed", {
                tenantId: tenant.tenantId,
                reason: "phone",
                status: phone.status,
            });
            if (phone.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            // Depois do SMS a Graph atrasa o nó do chip. A conexão já está gravada.
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-deferred", {
                tenantId: tenant.tenantId,
                reason: "phone_not_ready",
                status: phone.status,
            });
            return toMetaWhatsappPublicConnection(open);
        }
        const phoneWaba = wabaIdFromPhoneJson(phone.json);
        const graphWabaId = String(waba.json?.id || "").trim();
        if (!graphWabaId || graphWabaId !== wabaId || (phoneWaba && phoneWaba !== wabaId)) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-failed", {
                tenantId: tenant.tenantId,
                reason: "phone_not_in_waba",
            });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        }
        const connected = await this.repository.markConnected(tenant.tenantId, open.id, {
            displayPhoneNumber: String(phone.json?.display_phone_number || open.displayPhoneNumber || "").trim() || null,
            verifiedName: String(phone.json?.verified_name || open.verifiedName || "").trim() || null,
            qualityRating: String(phone.json?.quality_rating || "").trim() || null,
            actorEmail: tenant.ownerEmail,
        });
        if (!connected)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validated", {
            tenantId: tenant.tenantId,
            connectionId: connected.id,
            hasWaba: true,
            hasPhone: true,
            hasQuality: Boolean(connected.qualityRating),
            status: connected.status,
        });
        try {
            await requestOfficialPhoneDisplayName(this.graph, {
                token,
                tenantId: tenant.tenantId,
                phoneNumberId,
                currentVerifiedName: connected.verifiedName,
            });
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-skip", { tenantId: tenant.tenantId });
        }
        return toMetaWhatsappPublicConnection(connected);
    }
    async listPortfolioAssets(auth, opts) {
        const tenant = requireTenant(auth);
        const requested = String(opts?.connectionId || "").trim();
        if (opts?.fresh)
            (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        if ((0, meta_whatsapp_graph_cooldown_1.isMetaGraphUploadCooldown)()) {
            const stale = (0, meta_whatsapp_portfolio_graph_cache_1.readStaleCachedPortfolioGraph)(tenant.tenantId);
            if (stale?.portfolios?.length) {
                return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(stale.portfolios, requested));
            }
            return withLocalIdentities(tenant.tenantId, await this.loadStoredPortfolioAssets(tenant.tenantId, requested));
        }
        const useCache = (0, meta_whatsapp_portfolio_graph_cache_1.shouldUsePortfolioGraphCache)() && !opts?.fresh;
        if (useCache) {
            const cached = (0, meta_whatsapp_portfolio_graph_cache_1.readCachedPortfolioGraph)(tenant.tenantId);
            if (cached?.portfolios?.length) {
                return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(cached.portfolios, requested));
            }
            const pending = (0, meta_whatsapp_portfolio_graph_cache_1.readPortfolioGraphInflight)(tenant.tenantId);
            if (pending) {
                const raw = await pending;
                return withLocalIdentities(tenant.tenantId, assetsFromPortfolioCards(raw.portfolios || [], requested));
            }
        }
        const work = this.loadPortfolioGraphAssets(tenant.tenantId, requested, tenant.ownerEmail);
        if (useCache)
            (0, meta_whatsapp_portfolio_graph_cache_1.setPortfolioGraphInflight)(tenant.tenantId, work);
        try {
            const raw = await work;
            if ((0, meta_whatsapp_portfolio_graph_cache_1.shouldUsePortfolioGraphCache)())
                (0, meta_whatsapp_portfolio_graph_cache_1.writeCachedPortfolioGraph)(tenant.tenantId, raw);
            return withLocalIdentities(tenant.tenantId, raw);
        }
        finally {
            (0, meta_whatsapp_portfolio_graph_cache_1.clearPortfolioGraphInflight)(tenant.tenantId);
        }
    }
    async loadStoredPortfolioAssets(tenantId, requested) {
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenantId)
            : [await this.repository.findOpenByTenant(tenantId)].filter((item) => Boolean(item));
        const cards = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)(rows.map((row) => ({ ...cardFromConnection(row), numbers: storedNumbersFromConnection(row) }))).filter(meta_whatsapp_portfolio_map_1.isRenderablePortfolioCard);
        return assetsFromPortfolioCards(cards, requested);
    }
    async loadPortfolioGraphAssets(tenantId, requested, actorEmail = "") {
        const repo = this.repository;
        if (typeof repo.reopenLeftManagerForBusinesses === "function") {
            try {
                const restored = await repo.reopenLeftManagerForBusinesses(tenantId, (0, meta_whatsapp_known_owned_wabas_1.businessIdsToReopenAfterFalseLeftManager)(), actorEmail);
                if (restored) {
                    (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenantId);
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-reopen-left-manager", {
                        tenantId,
                        restored,
                    });
                }
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-reopen-left-manager-failed", { tenantId });
            }
        }
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenantId)
            : [await this.repository.findOpenByTenant(tenantId)].filter((item) => Boolean(item));
        if (!rows.length) {
            return {
                portfolios: [],
                selectedConnectionId: null,
                portfolio: null,
                numbers: [],
            };
        }
        const writeTokens = collectPortfolioWriteTokens(rows, this.decrypt);
        const hydrated = await Promise.all(rows.map((row) => hydrateOpenConnection(this.graph, this.decrypt, tenantId, row, (0, meta_whatsapp_template_waba_ids_1.extraWabaIdsFromConnections)(rows, row), writeTokens)));
        const leftIds = hydrated
            .filter((item) => item.leftManager)
            .map((item) => String(item.connectionId || "").trim())
            .filter(Boolean);
        const kept = hydrated.filter((item) => !item.leftManager);
        const cards = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)(kept.map((item) => item.card)).filter(meta_whatsapp_portfolio_map_1.isRenderablePortfolioCard);
        if (leftIds.length && typeof repo.disconnectOne === "function") {
            for (const connectionId of leftIds) {
                try {
                    await repo.disconnectOne(tenantId, connectionId, actorEmail);
                }
                catch {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-left-manager-disconnect-failed", {
                        tenantId,
                        connectionId,
                    });
                }
            }
            (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenantId);
        }
        const raw = assetsFromPortfolioCards(cards, requested);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-listed", {
            tenantId,
            hasBusiness: Boolean(raw.portfolio?.id),
            numbers: raw.numbers.length,
            leftManager: leftIds.length,
        });
        return raw;
    }
    async registerPhoneFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenant.tenantId)
            : [await this.repository.findOpenByTenant(tenant.tenantId)].filter((item) => Boolean(item));
        const connectionId = String(input.connectionId || "").trim();
        const requestedPhone = String(input.phoneNumberId || "").trim();
        const open = (connectionId ? rows.find((item) => item.id === connectionId) : null) ||
            rows.find((item) => String(item.phoneNumberId || "").trim() === requestedPhone) ||
            rows[0] ||
            null;
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const phoneNumberId = requestedPhone || String(open.phoneNumberId || "").trim();
        const pin = String(input.pin || "").trim();
        if (!phoneNumberId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        if (!/^\d{6}$/.test(pin))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_pin");
        const phoneWabaId = (0, meta_whatsapp_known_owned_wabas_1.knownWabaIdForPendingPhone)(phoneNumberId) ||
            String(rows.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId)?.wabaId || "").trim();
        const selectedBm = String(open.metaBusinessId || "").trim();
        const sameBm = rows.filter((row) => {
            if (row.id === open.id)
                return true;
            const rowWaba = String(row.wabaId || "").trim();
            if (phoneWabaId && rowWaba === phoneWabaId)
                return true;
            const bm = String(row.metaBusinessId || "").trim();
            if (!selectedBm || !bm)
                return true;
            return (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(bm, selectedBm) || (0, meta_whatsapp_known_owned_wabas_1.knownOwnedBusinessesMatch)(bm, selectedBm);
        });
        const candidates = [...sameBm].sort((left, right) => {
            const leftWaba = String(left.wabaId || "").trim();
            const rightWaba = String(right.wabaId || "").trim();
            const leftMatch = phoneWabaId && leftWaba === phoneWabaId ? 0 : 1;
            const rightMatch = phoneWabaId && rightWaba === phoneWabaId ? 0 : 1;
            if (leftMatch !== rightMatch)
                return leftMatch - rightMatch;
            if (left.id === open.id)
                return -1;
            if (right.id === open.id)
                return 1;
            return 0;
        });
        let token = "";
        let used = open;
        let registered = null;
        for (const candidate of candidates.length ? candidates : [open]) {
            try {
                token = this.decrypt(candidate.accessTokenEncrypted);
            }
            catch {
                continue;
            }
            if (!token)
                continue;
            used = candidate;
            registered = await this.graph({
                token,
                method: "POST",
                path: `${phoneNumberId}/register`,
                body: { messaging_product: "whatsapp", pin },
            });
            if (registered.ok)
                break;
            const code = String(registered.graphCode ||
                (registered.json && typeof registered.json === "object"
                    ? registered.json.error?.code
                    : "") ||
                "").trim();
            if (code === "133005" || code === "133006" || code === "133008" || code === "133009")
                break;
        }
        if (!token) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        if (!registered || !registered.ok) {
            const graphCode = String(registered?.graphCode || "").trim();
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-failed", {
                tenantId: tenant.tenantId,
                reason: "graph",
                status: registered?.status || 0,
                graphCode,
                phoneWabaId: phoneWabaId || null,
                connectionWabaId: String(used.wabaId || "").trim() || null,
            });
            if (registered?.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            throw new meta_whatsapp_errors_1.MetaWhatsappError("register_failed", undefined, (0, meta_whatsapp_graph_errors_1.publicMetaGraphRegisterMessage)({
                status: registered?.status || 0,
                json: registered?.json,
                graphCode,
                phoneWabaId,
                phoneWabaName: (0, meta_whatsapp_known_owned_wabas_1.knownWabaNameForId)(phoneWabaId),
            }));
        }
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-registered", {
            tenantId: tenant.tenantId,
            connectionId: used.id,
        });
        if (open.wabaId && open.phoneNumberId && open.status !== "connected" && rows[0]?.id === open.id) {
            try {
                await this.confirmFromAuth(auth);
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-confirm-skip", { tenantId: tenant.tenantId });
            }
        }
        try {
            await requestOfficialPhoneDisplayName(this.graph, {
                token,
                tenantId: tenant.tenantId,
                phoneNumberId,
                currentVerifiedName: open.verifiedName,
            });
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-skip", { tenantId: tenant.tenantId });
        }
        (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        return this.listPortfolioAssets(auth, { fresh: true });
    }
    async updatePhoneProfileFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const phoneNumberId = String(input.phoneNumberId || "").trim();
        const displayName = (0, meta_whatsapp_phone_profile_1.parseDisplayName)(input.displayName);
        const sentPhoto = Boolean((input.photoBytes && input.photoBytes.length) || String(input.photoBase64 || "").trim());
        const photo = input.photoBytes?.length
            ? (0, meta_whatsapp_phone_profile_1.parseProfilePhotoFromBytes)(input.photoBytes, input.photoMime)
            : (0, meta_whatsapp_phone_profile_1.parseProfilePhoto)({ photoBase64: input.photoBase64, photoMime: input.photoMime });
        const vertical = (0, meta_whatsapp_phone_profile_1.parseVertical)(input.vertical);
        const description = (0, meta_whatsapp_phone_profile_1.parseDescription)(input.description);
        const address = (0, meta_whatsapp_phone_profile_1.parseAddress)(input.address);
        const email = (0, meta_whatsapp_phone_profile_1.parseEmail)(input.email);
        if (vertical === null || description === null || address === null || email === null) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        // "" do front = campo omitido/sem mudança; não dispara POST de perfil sozinho.
        const hasBiz = Boolean(vertical || description || address || email);
        if (sentPhoto && !photo) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_photo_update_failed");
        }
        if (!phoneNumberId || (!displayName && !photo && !hasBiz)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenant.tenantId)
            : [await this.repository.findOpenByTenant(tenant.tenantId)].filter((item) => Boolean(item));
        const connectionId = String(input.connectionId || "").trim();
        const open = (connectionId ? rows.find((item) => item.id === connectionId) : null) ||
            rows.find((item) => String(item.phoneNumberId || "").trim() === phoneNumberId) ||
            rows[0] ||
            null;
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const assets = await this.listPortfolioAssets(auth, { connectionId: open.id });
        const allNumbers = [
            ...assets.numbers,
            ...(assets.portfolios || []).flatMap((item) => item.numbers || []),
        ];
        const numberRow = allNumbers.find((row) => row.phoneNumberId === phoneNumberId);
        if (!numberRow)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        if (!(0, meta_whatsapp_portfolio_map_1.isMetaPhoneConnected)(numberRow.metaStatus)) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                tenantId: tenant.tenantId,
                reason: "not_registered",
            });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("phone_not_registered");
        }
        let namePending = false;
        let nameNeedsRegister = false;
        let nameUpdated = false;
        let nameFailure = null;
        const wantsProfile = Boolean(photo) || hasBiz;
        if (displayName) {
            const renamed = await this.graph({
                token,
                method: "POST",
                path: phoneNumberId,
                query: { new_display_name: displayName },
            });
            if (!renamed.ok) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "name",
                    status: renamed.status,
                    graphCode: renamed.graphCode,
                });
                if (renamed.status === 401) {
                    // Token morto: sem sentido tentar foto/perfil.
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                }
                nameFailure = "display_name_update_failed";
                // Nome e foto são independentes na Graph — segue com foto/dados se houver.
                if (!wantsProfile)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("display_name_update_failed");
            }
            else {
                nameUpdated = true;
                const nameNode = await this.graph({
                    token,
                    method: "GET",
                    path: phoneNumberId,
                    query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NAME_FIELDS },
                });
                const named = nameNode.ok
                    ? (0, meta_whatsapp_portfolio_map_1.mapPhoneNameFields)(nameNode.json)
                    : {
                        verifiedName: null,
                        nameStatus: null,
                        newDisplayName: null,
                        newNameStatus: null,
                    };
                const nameSync = (0, meta_whatsapp_portfolio_map_1.resolvePhoneNameSync)({
                    verifiedName: named.verifiedName,
                    nameStatus: named.nameStatus,
                    newDisplayName: named.newDisplayName || displayName,
                    newNameStatus: named.newNameStatus,
                    localName: displayName,
                });
                namePending = nameSync.nameSyncStatus === "pending";
                nameNeedsRegister = nameSync.nameNeedsRegister;
            }
        }
        const profileBody = { messaging_product: "whatsapp" };
        if (vertical)
            profileBody.vertical = vertical;
        if (description)
            profileBody.description = description;
        if (address)
            profileBody.address = address;
        if (email)
            profileBody.email = email;
        let photoUpdated = false;
        let profileUpdated = false;
        if (photo) {
            const appId = (0, meta_config_1.readMetaAppId)();
            if (!appId)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("config_invalid");
            try {
                const uploaded = await this.uploadImage({
                    token,
                    appId,
                    fileName: photo.fileName,
                    mime: photo.mime,
                    bytes: photo.bytes,
                });
                const handle = String(uploaded.handle || "").trim();
                if (!handle)
                    throw new Error("upload-handle vazio");
                profileBody.profile_picture_handle = handle;
            }
            catch (error) {
                if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError)
                    throw error;
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "upload",
                    detail: String(error?.message || "").slice(0, 80),
                });
                // Se o nome já foi aceito, reporta falha só da foto.
                if (nameUpdated)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_photo_update_failed");
                if (nameFailure)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_update_failed");
                throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_photo_update_failed");
            }
        }
        if (Object.keys(profileBody).length > 1) {
            const profile = await this.graph({
                token,
                method: "POST",
                path: `${phoneNumberId}/whatsapp_business_profile`,
                body: profileBody,
            });
            if (!profile.ok) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "profile",
                    status: profile.status,
                    graphCode: profile.graphCode,
                });
                if (profile.status === 401)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                if (nameUpdated)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_photo_update_failed");
                if (nameFailure)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_update_failed");
                throw new meta_whatsapp_errors_1.MetaWhatsappError(photo ? "profile_photo_update_failed" : "profile_update_failed");
            }
            photoUpdated = Boolean(photo);
            profileUpdated = true;
        }
        (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
            name: nameUpdated ? displayName || undefined : undefined,
            channelName: nameUpdated ? displayName || undefined : undefined,
            photo: photoUpdated && photo
                ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
                : undefined,
            vertical: profileUpdated && vertical !== undefined ? vertical || null : undefined,
            description: profileUpdated && description !== undefined ? description : undefined,
            address: profileUpdated && address !== undefined ? address : undefined,
            email: profileUpdated && email !== undefined ? email || null : undefined,
            ...(photoUpdated ? { photoMetaApplied: true, photoSource: "local-upload" } : {}),
            ...(profileUpdated && (vertical || description || address || email)
                ? { profileMetaApplied: true }
                : {}),
        });
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-updated", {
            tenantId: tenant.tenantId,
            namePending,
            nameNeedsRegister,
            nameUpdated,
            photoUpdated,
            profileUpdated,
            nameFailure: nameFailure || null,
        });
        (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        const listed = await this.listPortfolioAssets(auth, { connectionId: open.id, fresh: true });
        // Foto/dados ok + nome recusado: sucesso parcial (não mascara a foto aplicada).
        return {
            ...listed,
            namePending,
            nameNeedsRegister: nameNeedsRegister ||
                listed.numbers.some((row) => row.phoneNumberId === phoneNumberId && row.nameNeedsRegister),
            nameUpdated,
            photoUpdated,
            profileUpdated,
            nameRejected: Boolean(nameFailure),
            nameRejectMessage: nameFailure
                ? "A Meta recusou o novo nome de exibição. A foto e os dados da empresa foram enviados."
                : null,
        };
    }
    async readPhonePhotoFromAuth(auth, phoneNumberId) {
        const tenant = requireTenant(auth);
        const id = String(phoneNumberId || "").trim();
        if (!id)
            return null;
        return (0, meta_whatsapp_phone_identity_store_1.readPhonePhoto)(tenant.tenantId, id);
    }
    async setPhoneInboxFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const phoneNumberId = String(input.phoneNumberId || "").trim();
        if (!phoneNumberId || typeof input.enabled !== "boolean") {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const openRows = await this.repository.listOpenByTenant(tenant.tenantId);
        const preferredId = String(input.connectionId || "").trim();
        const open = (preferredId ? openRows.find((row) => row.id === preferredId) : undefined) ||
            openRows.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId) ||
            openRows[0] ||
            null;
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const current = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenant.tenantId, phoneNumberId);
        const displayPhoneNumber = String(input.displayPhoneNumber || "").trim() ||
            current?.displayPhoneNumber ||
            open.displayPhoneNumber ||
            null;
        const channelName = String(input.channelName || "").trim() ||
            current?.channelName ||
            open.verifiedName ||
            null;
        const saved = (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
            inboxEnabled: input.enabled,
            displayPhoneNumber,
            channelName,
        });
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-inbox-updated", { tenantId: tenant.tenantId, enabled: input.enabled });
        return {
            phoneNumberId,
            inboxEnabled: input.enabled,
            displayPhoneNumber: saved.displayPhoneNumber,
            channelName: saved.channelName,
        };
    }
    async subscribeWebhooksFromAuth(auth, opts) {
        const tenant = requireTenant(auth);
        const openRows = await this.repository.listOpenByTenant(tenant.tenantId);
        const targets = pickConnectionsForWebhookSubscribe(openRows, opts);
        if (!targets.length) {
            return {
                subscribed: false,
                alreadySubscribed: false,
                detail: "WABA ainda não confirmada.",
                wabaCount: 0,
            };
        }
        let anyOk = false;
        let allAlready = true;
        const details = [];
        for (const connection of targets) {
            const result = await this.webhookSubscriptions.ensureSubscribed(connection);
            if (result.ok)
                anyOk = true;
            if (!result.alreadySubscribed)
                allAlready = false;
            if (result.detail)
                details.push(result.detail);
            if (!result.ok) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("webhook-subscribe-failed", {
                    tenantId: tenant.tenantId,
                    connectionId: connection.id,
                });
            }
        }
        return {
            subscribed: anyOk,
            alreadySubscribed: anyOk && allAlready,
            detail: anyOk ? undefined : details[0] || "Falha ao inscrever webhooks.",
            wabaCount: targets.length,
        };
    }
    async readPortfolioPhotoFromAuth(auth, businessId) {
        const tenant = requireTenant(auth);
        const biz = String(businessId || "").trim();
        if (biz)
            return (0, meta_whatsapp_portfolio_identity_store_1.readPortfolioBusinessPhoto)(tenant.tenantId, biz);
        return (0, meta_whatsapp_portfolio_identity_store_1.readPortfolioPhoto)(tenant.tenantId);
    }
}
exports.MetaWhatsappConnectionService = MetaWhatsappConnectionService;
