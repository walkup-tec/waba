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
const meta_whatsapp_template_graph_client_1 = require("./meta-whatsapp-template-graph.client");
const meta_whatsapp_template_repository_1 = require("./meta-whatsapp-template.repository");
const meta_whatsapp_portfolio_graph_cache_1 = require("./meta-whatsapp-portfolio-graph-cache");
const meta_whatsapp_known_owned_wabas_1 = require("./meta-whatsapp-known-owned-wabas");
const meta_whatsapp_manual_business_store_1 = require("./meta-whatsapp-manual-business.store");
const meta_whatsapp_hidden_business_store_1 = require("./meta-whatsapp-hidden-business.store");
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
    const localizeNumbers = (numbers, placeholderName, hidden, businessId) => (0, meta_whatsapp_phone_occupancy_1.applyCloudPhoneOccupancy)(tenantId, (0, meta_whatsapp_phone_identity_store_1.applyLocalPhoneIdentities)(tenantId, numbers, placeholderName, { hidden, businessId }), busyPhoneIds);
    const portfolio = assets.portfolio ? localizeCard(assets.portfolio) : null;
    const portfolios = (assets.portfolios || []).map((item) => ({
        ...localizeCard(item),
        numbers: localizeNumbers(item.numbers || [], item.name || item.primaryPageName, item.hidden === true, item.id),
    }));
    return {
        ...assets,
        portfolios,
        selectedConnectionId: assets.selectedConnectionId ?? null,
        portfolio: portfolio,
        numbers: localizeNumbers(assets.numbers || [], assets.portfolio?.name || assets.portfolio?.primaryPageName, assets.portfolio?.hidden === true, assets.portfolio?.id),
    };
}
/** Cards Ativas dos BMs de cliente mesmo se me/businesses, cache ou cooldown omitirem o GET. */
function catalogBackfillPlaceholderCards(tenantId, existing) {
    const out = [];
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.catalogBackfillBusinessIds)()) {
        if ((0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenantId, id))
            continue;
        if (existing.some((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id || ""), id)))
            continue;
        const name = (0, meta_whatsapp_known_owned_wabas_1.catalogBusinessLabel)(id) || null;
        if (!name)
            continue;
        out.push({
            id,
            name,
            primaryPageId: null,
            primaryPageName: null,
            profilePictureUrl: null,
            wabaId: null,
            hidden: false,
            numbers: [],
        });
    }
    return out;
}
function manualPlaceholderCards(tenantId, existing) {
    const out = [];
    for (const row of (0, meta_whatsapp_manual_business_store_1.listManualBusinesses)(tenantId)) {
        const id = String(row.id || "").trim();
        if (!id || (0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenantId, id))
            continue;
        if (existing.some((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id || ""), id)))
            continue;
        out.push({
            id,
            name: row.name || null,
            primaryPageId: null,
            primaryPageName: null,
            profilePictureUrl: null,
            wabaId: String(row.wabaId || "").trim() || null,
            hidden: false,
            numbers: [],
        });
    }
    return out;
}
function applyManualStoredWabas(tenantId, cards) {
    const manuals = (0, meta_whatsapp_manual_business_store_1.listManualBusinesses)(tenantId);
    if (!manuals.length)
        return cards;
    return cards.map((card) => {
        const row = manuals.find((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(item.id, String(card.id || "")));
        const stored = String(row?.wabaId || "").trim();
        if (!stored)
            return card;
        return { ...card, wabaId: String(card.wabaId || "").trim() || stored };
    });
}
function seedKnownPortfolioCards(tenantId, fromRows) {
    const base = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)(fromRows).filter(meta_whatsapp_portfolio_map_1.isRenderablePortfolioCard);
    const manuals = manualPlaceholderCards(tenantId, base);
    const catalog = catalogBackfillPlaceholderCards(tenantId, [...base, ...manuals]);
    return applyManualStoredWabas(tenantId, (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)([...base, ...manuals, ...catalog]).filter(meta_whatsapp_portfolio_map_1.isRenderablePortfolioCard));
}
function markHiddenPortfolioAssets(tenantId, assets) {
    const hiddenRows = (0, meta_whatsapp_hidden_business_store_1.listHiddenBusinesses)(tenantId);
    const isHiddenId = (value) => hiddenRows.some((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(value || ""), row.id));
    const portfolios = (assets.portfolios || []).map((item) => ({
        ...item,
        hidden: isHiddenId(String(item.id || "")),
    }));
    for (const row of hiddenRows) {
        if (portfolios.some((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id || ""), row.id)))
            continue;
        portfolios.push({
            id: row.id,
            name: row.name || null,
            primaryPageId: null,
            primaryPageName: null,
            profilePictureUrl: null,
            wabaId: null,
            hidden: true,
            numbers: [],
        });
    }
    const active = portfolios.filter((item) => !item.hidden);
    const withNumbers = active.filter(cardHasListedNumbers);
    const requested = String(assets.selectedConnectionId || assets.portfolio?.id || "");
    const pick = (list) => list.find((item) => item.connectionId === requested) ||
        list.find((item) => item.id && (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id), requested)) ||
        list[0] ||
        null;
    const selected = pick(withNumbers) || pick(active);
    return {
        ...assets,
        portfolios,
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
                hidden: selected.hidden,
            }
            : null,
        numbers: selected?.numbers || [],
    };
}
function localizeAndHidePortfolioAssets(tenantId, assets) {
    return markHiddenPortfolioAssets(tenantId, withLocalIdentities(tenantId, assets));
}
function assetsFromPortfolioCards(cards, requested) {
    const withNumbers = cards.filter(cardHasListedNumbers);
    const pick = (list) => list.find((item) => item.connectionId === requested) ||
        list.find((item) => item.id && item.id === requested) ||
        list[0];
    const selected = pick(withNumbers) || pick(cards);
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
    const identity = phoneNumberId ? (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(String(open.tenantId || ""), phoneNumberId) : null;
    const storedUi = identity?.uiStatus || null;
    const uiStatus = storedUi === "restrito"
        ? "restrito"
        : storedUi === "ativo" || open.status === "connected"
            ? "ativo"
            : (0, meta_whatsapp_portfolio_map_1.resolveMetaPhoneUiStatus)({ verifiedName: open.verifiedName });
    return [
        {
            phoneNumberId: phoneNumberId || display,
            displayPhoneNumber: display || null,
            verifiedName: open.verifiedName,
            qualityRating: open.qualityRating,
            metaStatus: null,
            codeVerificationStatus: null,
            healthCanSend: null,
            uiStatus,
            dispatchStatus: "livre",
            canActivate: (0, meta_whatsapp_portfolio_map_1.canActivateMetaPhoneNumber)(uiStatus, false),
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
    const agency = [];
    const rest = [];
    for (const row of out) {
        if ((0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, row.metaBusinessId))) {
            agency.push(row);
        }
        else {
            rest.push(row);
        }
    }
    return [...agency, ...rest];
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
    const invitedBm = Boolean(selectedBm) &&
        !(0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, selectedBm));
    if (invitedBm) {
        for (const row of pool) {
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
const INVITED_DISCOVER_GRAPH = { maxAttempts: 1, timeoutMs: 20000 };
const HYDRATE_PHONE_BUDGET_MS = 18000;
const HYDRATE_NAME_PROFILE_BUDGET_MS = 2500;
const LIST_FAST_STORED_MS = 4000;
const OFFICIAL_NAME_GRAPH_TIMEOUT_MS = 4000;
async function raceWithTimeout(work, timeoutMs) {
    let timer;
    const guarded = work.then((value) => value, () => null);
    try {
        return await Promise.race([
            guarded,
            new Promise((resolve) => {
                timer = setTimeout(() => resolve(null), Math.max(0, timeoutMs));
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function cardHasListedNumbers(card) {
    return (card?.numbers || []).some((row) => Boolean(String(row.displayPhoneNumber || row.phoneNumberId || "").trim()));
}
function assetsHaveListedNumbers(assets) {
    return (assets?.portfolios || []).some((item) => item.hidden !== true && (0, meta_whatsapp_portfolio_map_1.isRenderablePortfolioCard)(item) && cardHasListedNumbers(item));
}
function listedNumbersNeedGraphStatus(assets) {
    return (assets?.numbers || []).some((row) => {
        const ui = String(row.uiStatus || "");
        const meta = String(row.metaStatus || "").trim();
        return ui === "pendente" && !meta;
    });
}
function cardNeedsWabaOrNumbers(card) {
    return !cardHasListedNumbers(card) || !cardHasListedWaba(card);
}
function focusedBusinessNeedsWaba(assets, businessId) {
    const bm = String(businessId || "").trim();
    if (!bm)
        return false;
    const card = (assets?.portfolios || []).find((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id || ""), bm));
    if (!card || card.hidden === true)
        return true;
    return cardNeedsWabaOrNumbers(card);
}
function withHydrateLimits(graph) {
    return (input) => graph({
        ...input,
        maxAttempts: input.maxAttempts ?? HYDRATE_GRAPH.maxAttempts,
        timeoutMs: input.timeoutMs ?? HYDRATE_GRAPH.timeoutMs,
    });
}
function withInvitedDiscoverLimits(graph) {
    return (input) => graph({
        ...input,
        maxAttempts: input.maxAttempts ?? INVITED_DISCOVER_GRAPH.maxAttempts,
        timeoutMs: input.timeoutMs ?? INVITED_DISCOVER_GRAPH.timeoutMs,
    });
}
function listedHasBusinessId(listedIds, businessId) {
    return [...listedIds].some((listed) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(listed, businessId));
}
async function collectSelectPageAdminCards(input) {
    const cards = [];
    const listedIds = new Set();
    const assignedByConnectionId = new Map();
    const jsonByToken = new Map();
    const addIfMissing = (card) => {
        const id = String(card?.id || "").trim();
        if (!id || !card || listedHasBusinessId(listedIds, id))
            return;
        listedIds.add(id);
        cards.push(card);
    };
    for (const row of input.writeTokens) {
        const token = String(row.token || "").trim();
        if (!token)
            continue;
        if (!jsonByToken.has(token)) {
            const debug = await listDebugTokenWhatsappTargets(input.graph, token);
            const json = await (0, meta_whatsapp_portfolio_graph_1.fetchAssignedBusinesses)(input.graph, token, {
                facebookUserIds: debug.userId ? [debug.userId] : [],
            });
            jsonByToken.set(token, json);
            for (const card of (0, meta_whatsapp_portfolio_graph_1.directoryFromAssigned)(json))
                addIfMissing(card);
        }
        assignedByConnectionId.set(row.id, jsonByToken.get(token));
    }
    const tokens = [...jsonByToken.keys()];
    const extraIds = [
        ...(0, meta_whatsapp_known_owned_wabas_1.catalogBackfillBusinessIds)(),
        ...(input.extraBusinessIds || []).map((id) => (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(id)).filter(Boolean),
    ];
    for (const businessId of extraIds) {
        if (listedHasBusinessId(listedIds, businessId))
            continue;
        for (const token of tokens) {
            const found = await (0, meta_whatsapp_portfolio_graph_1.fetchVisibleBusinessCard)(input.graph, token, businessId);
            if (found) {
                addIfMissing(found);
                break;
            }
        }
    }
    const shortGraph = (req) => input.graph({ ...req, maxAttempts: 1, timeoutMs: 2500 });
    try {
        for (const token of tokens) {
            const nodes = await (0, meta_whatsapp_portfolio_graph_1.discoverAdministeredBusinessNodes)(shortGraph, token, (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)(), { onlyClients: true });
            for (const card of (0, meta_whatsapp_portfolio_graph_1.directoryFromAssigned)({ data: nodes }))
                addIfMissing(card);
        }
    }
    catch {
        /* /clients lento não pode impedir a lista da select */
    }
    try {
        for (const token of tokens) {
            const nodes = await (0, meta_whatsapp_portfolio_graph_1.discoverAdministeredBusinessNodes)(shortGraph, token, (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)(), { onlyOwned: true });
            for (const card of (0, meta_whatsapp_portfolio_graph_1.directoryFromAssigned)({ data: nodes }))
                addIfMissing(card);
        }
    }
    catch {
        /* /owned_businesses lento não pode impedir a lista da select */
    }
    return { cards, assignedByConnectionId };
}
async function hydrateOpenConnection(graph, decrypt, tenantId, open, extraWabaIds = [], writeTokens = [], extras = {}) {
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
    const debugTargets = await listDebugTokenWhatsappTargets(g, token);
    const [assignedJson, fetchedBm] = await Promise.all([
        extras.assignedJson !== undefined
            ? Promise.resolve(extras.assignedJson)
            : (0, meta_whatsapp_portfolio_graph_1.fetchAssignedBusinesses)(g, token, { facebookUserIds: debugTargets.userId ? [debugTargets.userId] : [] }),
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
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.equivalentOwnedWabaIdsForBusiness)(businessId || storedBm, primaryWabaId || storedWaba)) {
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
    for (const id of (0, meta_whatsapp_known_owned_wabas_1.equivalentOwnedWabaIdsForBusiness)(businessId || storedBm, primaryWabaId || storedWaba)) {
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
    merged = await confirmPendingPhoneStatusFromGraph(g, [token, ...writeTokens.map((row) => row.token)], merged, primaryWabaId);
    const needsName = merged.filter((row) => !row.nameStatus && !row.newNameStatus);
    let numbers = merged;
    const hydratePartial = false;
    if (needsName.length) {
        const named = await attachPhoneNameStatuses(g, token, needsName, card.name);
        numbers = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(merged, named);
    }
    const active = numbers.filter((row) => row.uiStatus === "ativo");
    if (active.length) {
        const withProfiles = await raceWithTimeout(attachPhoneBusinessProfiles(g, token, active, tenantId, card.name), HYDRATE_NAME_PROFILE_BUDGET_MS);
        if (withProfiles) {
            numbers = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(numbers, withProfiles);
        }
        else {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-hydrate-profile-budget", {
                tenantId,
                connectionId: open.id,
                listed: numbers.length,
            });
        }
    }
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
        hydratePartial,
    };
}
/** WABAs (management) e chips (messaging) liberados no token — Embedded Signup manage-accounts. */
async function listDebugTokenWhatsappTargets(graph, userToken) {
    const empty = { wabaIds: [], phoneIds: [], userId: "" };
    const appId = (0, meta_config_1.readMetaAppId)();
    const appSecret = (0, meta_config_1.readMetaAppSecret)();
    if (!appId || !appSecret || !userToken)
        return empty;
    const res = await graph({
        token: `${appId}|${appSecret}`,
        method: "GET",
        path: "debug_token",
        query: { input_token: userToken },
    });
    if (!res.ok)
        return empty;
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
    return {
        wabaIds: [...wabaIds],
        phoneIds: [...phoneIds],
        userId: String(payload.data?.user_id || "").trim(),
    };
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
/** GET /{phone-id} confirma CONNECTED quando a lista do WABA omite status ou deixa PENDING. */
async function confirmPendingPhoneStatusFromGraph(graph, tokens, numbers, stampWabaId) {
    const pendingIds = numbers
        .filter((row) => {
        const ui = String(row.uiStatus || "");
        const meta = String(row.metaStatus || "").trim();
        return ui === "pendente" || !meta;
    })
        .map((row) => String(row.phoneNumberId || "").trim())
        .filter(Boolean);
    if (!pendingIds.length)
        return numbers;
    const extra = await fetchPhoneNodes(graph, tokens, pendingIds, stampWabaId);
    if (!extra.length)
        return numbers;
    return (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(numbers, (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)({ data: extra }));
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
/**
 * BM convidada: nested com phone_numbers costuma 400/timeout e esconde o edge owned.
 * Lista só id,name + edges paginados; chips vêm depois em /{waba}/phone_numbers.
 */
async function collectInvitedBusinessWabaRefs(graph, token, businessId) {
    const bm = String(businessId || "").trim();
    if (!bm)
        return { wabaIds: [], clientWabaIds: [], phones: [], childIds: [] };
    const wabaIds = new Set();
    const clientWabaIds = new Set();
    const phones = [];
    let childIds = [];
    const isAgency = (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm));
    const nestedFieldSets = [
        [
            "id",
            "name",
            "owned_whatsapp_business_accounts{id,name}",
            "client_whatsapp_business_accounts{id,name}",
        ].join(","),
        [
            "id",
            "name",
            "owned_whatsapp_business_accounts.limit(100){id}",
            "client_whatsapp_business_accounts.limit(100){id}",
        ].join(","),
    ];
    let nestedMissLogged = false;
    for (const lightFields of nestedFieldSets) {
        const nested = await graph({
            token,
            method: "GET",
            path: bm,
            query: { fields: lightFields },
        });
        if (nested.ok) {
            const extracted = extractWabasAndPhonesFromBusinessNode(nested.json);
            for (const id of extracted.wabaIds)
                wabaIds.add(id);
            if (!isAgency) {
                for (const id of extracted.clientWabaIds)
                    clientWabaIds.add(id);
            }
            for (const phone of extracted.phones)
                phones.push(phone);
            break;
        }
        if (!nestedMissLogged) {
            nestedMissLogged = true;
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-nested-miss", {
                businessId: bm,
                status: nested.status,
                timeout: nested.timeout,
            });
        }
    }
    for (const id of await listBusinessWabaIds(graph, token, bm, "owned"))
        wabaIds.add(id);
    if (!isAgency) {
        for (const id of await listBusinessWabaIds(graph, token, bm, "client"))
            clientWabaIds.add(id);
    }
    if (!wabaIds.size) {
        childIds = await listBusinessChildIds(graph, token, bm);
        for (const childId of childIds) {
            for (const id of await listBusinessWabaIds(graph, token, childId, "owned"))
                wabaIds.add(id);
            if (!isAgency) {
                for (const id of await listBusinessWabaIds(graph, token, childId, "client"))
                    clientWabaIds.add(id);
            }
            if (wabaIds.size)
                break;
        }
    }
    if (!isAgency && !wabaIds.size && !phones.length && clientWabaIds.size) {
        const clientEdge = await graph({
            token,
            method: "GET",
            path: `${bm}/client_whatsapp_business_accounts`,
            query: {
                fields: `id,name,phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}`,
                limit: "100",
            },
        });
        if (clientEdge.ok) {
            const batch = Array.isArray(clientEdge.json?.data) ? clientEdge.json.data : [];
            for (const row of batch) {
                const rec = row && typeof row === "object" ? row : {};
                const wid = String(rec.id || "").trim();
                if (!wid || (0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(bm, wid))
                    continue;
                clientWabaIds.add(wid);
                for (const phone of takeWabaPhonesFromNode(row, wid))
                    phones.push(phone);
            }
        }
    }
    return { wabaIds: [...wabaIds], clientWabaIds: [...clientWabaIds], phones, childIds };
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
async function paginateBusinessEdgeIds(graph, token, path, fields) {
    const ids = new Set();
    const seen = new Set();
    let after = "";
    let firstOk = false;
    for (let page = 0; page < 20; page += 1) {
        const query = { limit: "100" };
        if (fields)
            query.fields = fields;
        if (after)
            query.after = after;
        const res = await graph({
            token,
            method: "GET",
            path,
            query,
        });
        if (!res.ok) {
            if (!firstOk)
                return { ok: false, ids: [] };
            break;
        }
        firstOk = true;
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
    return { ok: firstOk, ids: [...ids] };
}
/**
 * Lista WABA IDs de um Business Manager (owned = Propriedade de; client = compartilhada).
 * Token ES da BM convidada costuma 400 em `id,name`; tenta de novo só com `id`.
 * @see https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/
 * @see https://developers.facebook.com/docs/marketing-api/reference/business/
 */
async function listBusinessWabaIds(graph, token, businessId, edge = "owned") {
    const bm = String(businessId || "").trim();
    if (!bm)
        return [];
    const pathEdge = edge === "client" ? "client_whatsapp_business_accounts" : "owned_whatsapp_business_accounts";
    const path = `${bm}/${pathEdge}`;
    for (const fields of ["id,name", "id"]) {
        const page = await paginateBusinessEdgeIds(graph, token, path, fields);
        if (page.ok)
            return page.ids;
    }
    return [];
}
async function listBusinessChildIds(graph, token, businessId) {
    const bm = String(businessId || "").trim();
    if (!bm)
        return [];
    const ids = new Set();
    for (const edge of ["owned_businesses", "clients"]) {
        for (const fields of ["id,name", "id"]) {
            const page = await paginateBusinessEdgeIds(graph, token, `${bm}/${edge}`, fields);
            if (!page.ok)
                continue;
            for (const id of page.ids)
                ids.add(id);
            break;
        }
    }
    return [...ids].filter((id) => id !== bm).slice(0, 20);
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
    return (0, meta_whatsapp_portfolio_map_1.mergeMetaPhoneGraphRows)(...lists);
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
function emptyPartnerBucket() {
    return { wabaIds: [], phones: [] };
}
function partnerBucketForBusiness(byOwner, businessId) {
    const direct = byOwner.get((0, meta_whatsapp_known_owned_wabas_1.normalizeMetaBusinessKey)(businessId));
    if (direct)
        return direct;
    for (const [key, bucket] of byOwner) {
        if ((0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(key, businessId))
            return bucket;
    }
    return emptyPartnerBucket();
}
function addToPartnerBucket(byOwner, ownerId, wabaId, phones = []) {
    const key = (0, meta_whatsapp_known_owned_wabas_1.normalizeMetaBusinessKey)(ownerId);
    const wid = String(wabaId || "").trim();
    if (!key || !wid)
        return;
    let bucket = byOwner.get(key);
    if (!bucket) {
        bucket = emptyPartnerBucket();
        byOwner.set(key, bucket);
    }
    if (!bucket.wabaIds.includes(wid))
        bucket.wabaIds.push(wid);
    for (const phone of phones)
        bucket.phones.push(phone);
}
function mergePartnerBuckets(businessId, maps, extraBusinessIds = []) {
    const merged = emptyPartnerBucket();
    const ids = [businessId, ...extraBusinessIds];
    for (const id of ids) {
        const bm = String(id || "").trim();
        if (!bm)
            continue;
        for (const map of maps) {
            const bucket = partnerBucketForBusiness(map, bm);
            for (const wabaId of bucket.wabaIds) {
                if ((0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(businessId, wabaId))
                    continue;
                if (!merged.wabaIds.includes(wabaId))
                    merged.wabaIds.push(wabaId);
            }
            for (const phone of bucket.phones)
                merged.phones.push(phone);
        }
    }
    return merged;
}
function wabaNodeName(row) {
    const rec = row && typeof row === "object" ? row : {};
    return String(rec.name || "").trim();
}
function wabaRelatedNamesFromNode(row) {
    const rec = row && typeof row === "object" ? row : {};
    const names = [];
    const push = (value) => {
        if (typeof value === "string") {
            const name = value.trim();
            if (name && !names.includes(name))
                names.push(name);
            return;
        }
        const nested = value && typeof value === "object" ? String(value.name || "").trim() : "";
        if (nested && !names.includes(nested))
            names.push(nested);
    };
    push(rec.name);
    push(rec.owner_business_info);
    push(rec.on_behalf_of_business_info);
    return names;
}
function normalizePortfolioName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function portfolioNameKey(value) {
    return normalizePortfolioName(value);
}
function namesLikelySamePortfolio(left, right) {
    const a = normalizePortfolioName(left);
    const b = normalizePortfolioName(right);
    if (!a || !b)
        return false;
    if (a === b)
        return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    return shorter.length >= 8 && longer.includes(shorter);
}
function partnerBucketForCardName(byName, cardName) {
    if (!byName || !byName.size)
        return emptyPartnerBucket();
    const direct = byName.get(portfolioNameKey(cardName));
    if (direct)
        return direct;
    const merged = emptyPartnerBucket();
    for (const [key, bucket] of byName) {
        if (!namesLikelySamePortfolio(key, cardName))
            continue;
        for (const id of bucket.wabaIds) {
            if (!merged.wabaIds.includes(id))
                merged.wabaIds.push(id);
        }
        for (const phone of bucket.phones)
            merged.phones.push(phone);
    }
    return merged;
}
function addToNameBucket(byName, name, wabaId, phones = []) {
    const key = portfolioNameKey(name);
    const wid = String(wabaId || "").trim();
    if (!key || !wid)
        return;
    let bucket = byName.get(key);
    if (!bucket) {
        bucket = emptyPartnerBucket();
        byName.set(key, bucket);
    }
    if (!bucket.wabaIds.includes(wid))
        bucket.wabaIds.push(wid);
    for (const phone of phones)
        bucket.phones.push(phone);
}
function mergeNameBuckets(...maps) {
    const out = new Map();
    for (const src of maps) {
        if (!src)
            continue;
        for (const [key, bucket] of src) {
            const prev = out.get(key) || emptyPartnerBucket();
            for (const id of bucket.wabaIds) {
                if (!prev.wabaIds.includes(id))
                    prev.wabaIds.push(id);
            }
            for (const phone of bucket.phones)
                prev.phones.push(phone);
            out.set(key, prev);
        }
    }
    return out;
}
function wabaOwnerBusinessIdsFromNode(row) {
    const rec = row && typeof row === "object" ? row : {};
    const ids = [];
    const push = (value) => {
        const nested = value && typeof value === "object" ? String(value.id || "").trim() : "";
        if (nested && !ids.includes(nested))
            ids.push(nested);
    };
    push(rec.owner_business_info);
    push(rec.on_behalf_of_business_info);
    const mapped = String((0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(row).businessId || "").trim();
    if (mapped && !ids.includes(mapped))
        ids.push(mapped);
    return ids;
}
function takeWabaPhonesFromNode(row, wabaId) {
    const rec = row && typeof row === "object" ? row : {};
    const phoneBucket = rec.phone_numbers;
    const phoneData = phoneBucket && typeof phoneBucket === "object"
        ? phoneBucket.data
        : null;
    return Array.isArray(phoneData) ? stampPhoneRowsWithWabaId(phoneData, wabaId) : [];
}
async function collectOwnedWabasByBusinessFromMe(graph, token) {
    const byOwner = new Map();
    const fields = [
        "id",
        "name",
        `owned_whatsapp_business_accounts{id,name,phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
        "client_whatsapp_business_accounts{id,name}",
    ].join(",");
    const res = await graph({
        token,
        method: "GET",
        path: "me/businesses",
        query: { fields, limit: "50" },
    });
    if (!res.ok)
        return byOwner;
    const data = Array.isArray(res.json?.data) ? res.json.data : [];
    for (const node of data) {
        const rec = node && typeof node === "object" ? node : {};
        const bm = String(rec.id || "").trim();
        if (!bm)
            continue;
        const extracted = extractWabasAndPhonesFromBusinessNode(node);
        for (const id of extracted.wabaIds)
            addToPartnerBucket(byOwner, bm, id);
        for (const phone of extracted.phones) {
            const rec = phone && typeof phone === "object" ? phone : {};
            const wid = String(rec._portfolio_waba_id || "").trim();
            if (wid)
                addToPartnerBucket(byOwner, bm, wid, [phone]);
        }
        for (const id of extracted.clientWabaIds) {
            if ((0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(bm, id))
                continue;
            addToPartnerBucket(byOwner, bm, id);
        }
    }
    return byOwner;
}
/**
 * WABAs client da agência (Tech Provider) cujo owner ou on_behalf_of é o BM do card.
 * Sem owner na Graph, indexa pelo nome da WABA (Casa Buzina) para o card vazio.
 * Não usa o edge client do próprio BM — isso misturaria Rio de Janeiro 01 no André.
 */
async function collectAgencyClientWabasByOwner(graph, token) {
    const byOwner = new Map();
    const byName = new Map();
    const fieldSets = [
        [
            "id",
            "name",
            "owner_business_info{id,name}",
            "on_behalf_of_business_info{id,name}",
            `phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}`,
        ].join(","),
        ["id", "name", "owner_business_info{id,name}", "on_behalf_of_business_info{id,name}"].join(","),
        "id,owner_business_info{id},on_behalf_of_business_info{id}",
        "id",
    ];
    const ownerLookupFields = "id,name,owner_business_info{id,name},on_behalf_of_business_info{id,name}";
    for (const agency of (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)()) {
        let rows = null;
        for (const fields of fieldSets) {
            const collected = [];
            const seen = new Set();
            let after = "";
            let firstOk = false;
            for (let page = 0; page < 20; page += 1) {
                const query = { fields, limit: "100" };
                if (after)
                    query.after = after;
                const res = await graph({
                    token,
                    method: "GET",
                    path: `${agency}/client_whatsapp_business_accounts`,
                    query,
                });
                if (!res.ok)
                    break;
                firstOk = true;
                const batch = Array.isArray(res.json?.data) ? res.json.data : [];
                for (const row of batch)
                    collected.push(row);
                const nextAfter = String(res.json?.paging?.cursors?.after || "").trim();
                if (!nextAfter || nextAfter === after || seen.has(nextAfter) || !batch.length)
                    break;
                seen.add(nextAfter);
                after = nextAfter;
            }
            if (firstOk) {
                rows = collected;
                break;
            }
        }
        if (!rows)
            continue;
        for (const row of rows) {
            const rec = row && typeof row === "object" ? row : {};
            const wabaId = String(rec.id || "").trim();
            if (!wabaId)
                continue;
            let node = row;
            let ownerIds = wabaOwnerBusinessIdsFromNode(node);
            let wabaName = wabaNodeName(node);
            if (!ownerIds.length || !wabaName) {
                const info = await graph({
                    token,
                    method: "GET",
                    path: wabaId,
                    query: { fields: ownerLookupFields },
                });
                if (info.ok) {
                    node = info.json;
                    ownerIds = wabaOwnerBusinessIdsFromNode(node);
                    wabaName = wabaName || wabaNodeName(node);
                }
            }
            const phones = takeWabaPhonesFromNode(row, wabaId);
            for (const ownerId of ownerIds)
                addToPartnerBucket(byOwner, ownerId, wabaId, phones);
            for (const name of wabaRelatedNamesFromNode(node))
                addToNameBucket(byName, name, wabaId, phones);
        }
    }
    return { byOwner, byName };
}
async function collectDebugWabasByOwner(graph, token) {
    const byOwner = new Map();
    const byName = new Map();
    const debug = await listDebugTokenWhatsappTargets(graph, token);
    const pending = new Set(debug.wabaIds);
    const phoneNodes = debug.phoneIds.length ? await fetchPhoneNodes(graph, token, debug.phoneIds) : [];
    for (const row of phoneNodes) {
        const rec = row && typeof row === "object" ? row : {};
        const account = rec.whatsapp_business_account;
        const accountId = account && typeof account === "object"
            ? String(account.id || "").trim()
            : String(rec._portfolio_waba_id || "").trim();
        if (accountId)
            pending.add(accountId);
    }
    for (const wabaId of pending) {
        const res = await graph({
            token,
            method: "GET",
            path: wabaId,
            query: {
                fields: `id,name,owner_business_info{id},on_behalf_of_business_info{id},phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}`,
            },
        });
        if (!res.ok)
            continue;
        const rec = res.json && typeof res.json === "object" ? res.json : {};
        const ownerIds = wabaOwnerBusinessIdsFromNode(rec);
        const phones = takeWabaPhonesFromNode(rec, wabaId);
        for (const ownerId of ownerIds)
            addToPartnerBucket(byOwner, ownerId, wabaId, phones);
        for (const name of wabaRelatedNamesFromNode(rec))
            addToNameBucket(byName, name, wabaId, phones);
    }
    for (const row of phoneNodes) {
        const rec = row && typeof row === "object" ? row : {};
        const account = rec.whatsapp_business_account;
        const accountId = account && typeof account === "object"
            ? String(account.id || "").trim()
            : String(rec._portfolio_waba_id || "").trim();
        if (!accountId)
            continue;
        for (const [ownerId, bucket] of byOwner) {
            if (bucket.wabaIds.includes(accountId))
                addToPartnerBucket(byOwner, ownerId, accountId, [row]);
        }
        const label = String((account && typeof account === "object" ? account.name : "") ||
            rec.verified_name ||
            "").trim();
        if (label)
            addToNameBucket(byName, label, accountId, [row]);
    }
    return { byOwner, byName };
}
async function fanOutAdminBusinessNumbers(input) {
    const bm = String(input.businessId || "").trim();
    if (!bm)
        return { wabaIds: [], phones: [] };
    const wabaIds = new Set();
    const phones = [...input.seed.phones];
    for (const id of input.seed.wabaIds) {
        if ((0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(bm, id))
            continue;
        wabaIds.add(id);
    }
    if (!wabaIds.size) {
        for (const id of await listBusinessWabaIds(input.graph, input.token, bm, "owned"))
            wabaIds.add(id);
    }
    if (!wabaIds.size) {
        for (const id of await listBusinessWabaIds(input.graph, input.token, bm, "client")) {
            if ((0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(bm, id))
                continue;
            wabaIds.add(id);
        }
    }
    if (!wabaIds.size && !phones.length)
        return { wabaIds: [], phones: [] };
    const listedPhones = [];
    for (const wid of wabaIds) {
        const listed = await listWabaPhoneNumbersForPortfolio(input.graph, wid, input.token, input.writeTokens, bm);
        if (!listed.ok)
            continue;
        for (const row of stampPhoneRowsWithWabaId(listed.json.data, wid))
            listedPhones.push(row);
    }
    return { wabaIds: [...wabaIds], phones: mergePhoneNumberRows(phones, listedPhones) };
}
/**
 * Cards da select (BM administrado / backfill / + ID) não passam por hydrateOpenConnection.
 * Uma leitura compartilhada (me/businesses + debug_token + client da agência) alimenta
 * todas as Ativas; BM oculto não consome Graph. Sem teto que abandone o Sander.
 */
function connectionIdForPortfolioBusiness(openRows, businessId) {
    const bm = String(businessId || "").trim();
    if (!bm)
        return "";
    const hit = openRows.find((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), bm));
    return String(hit?.id || "").trim();
}
function applyDiscoveredWabasToCard(card, input) {
    const mapped = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)({ data: input.phones });
    if (!mapped.length && !input.wabaIds.length)
        return false;
    card.wabaId = String(card.wabaId || "").trim() || input.wabaIds[0] || card.wabaId;
    if (mapped.length)
        card.numbers = (0, meta_whatsapp_portfolio_map_1.unionPortfolioNumbers)(card.numbers || [], mapped);
    const ownConnection = String(input.connectionId || "").trim();
    if (ownConnection && !card.connectionId)
        card.connectionId = ownConnection;
    return true;
}
function cardHasListedWaba(card) {
    return Boolean(String(card?.wabaId || "").trim());
}
function cardHasListedPage(card) {
    return Boolean(String(card?.primaryPageName || card?.primaryPageId || "").trim());
}
function mergeInvitedRefsIntoSeed(seed, businessId, invited) {
    const next = {
        wabaIds: [...seed.wabaIds],
        phones: [...seed.phones, ...invited.phones],
    };
    const add = (id) => {
        const wid = String(id || "").trim();
        if (!wid || (0, meta_whatsapp_known_owned_wabas_1.isKnownClientWabaForBusiness)(businessId, wid))
            return;
        if (!next.wabaIds.includes(wid))
            next.wabaIds.push(wid);
    };
    for (const id of invited.wabaIds)
        add(id);
    const isAgency = (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, businessId));
    if (!isAgency && !invited.wabaIds.length) {
        for (const id of invited.clientWabaIds)
            add(id);
    }
    return next;
}
async function fillEmptyCardPageFromGraph(graph, writeTokens, card) {
    const bm = String(card.id || "").trim();
    if (!bm || cardHasListedPage(card))
        return;
    for (const row of writeTokens) {
        const token = String(row.token || "").trim();
        if (!token)
            continue;
        const pageRes = await graph({
            token,
            method: "GET",
            path: bm,
            query: { fields: meta_whatsapp_portfolio_graph_1.META_BUSINESS_PAGE_FIELDS },
        });
        if (pageRes.ok) {
            const mapped = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(pageRes.json, { id: bm });
            if (mapped.primaryPageName || mapped.primaryPageId) {
                card.primaryPageId = mapped.primaryPageId || card.primaryPageId;
                card.primaryPageName = mapped.primaryPageName || card.primaryPageName;
                card.profilePictureUrl = mapped.profilePictureUrl || card.profilePictureUrl;
            }
        }
        if (!cardHasListedPage(card)) {
            const nestedPages = await graph({
                token,
                method: "GET",
                path: bm,
                query: { fields: meta_whatsapp_portfolio_graph_1.META_BUSINESS_OWNED_PAGES_FIELDS },
            });
            if (nestedPages.ok) {
                const rec = nestedPages.json && typeof nestedPages.json === "object"
                    ? nestedPages.json
                    : {};
                const merged = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
                    fallback: card,
                    ownedPages: rec.owned_pages || nestedPages.json,
                });
                card.primaryPageId = merged.primaryPageId || card.primaryPageId;
                card.primaryPageName = merged.primaryPageName || card.primaryPageName;
                card.profilePictureUrl = merged.profilePictureUrl || card.profilePictureUrl;
            }
        }
        if (!cardHasListedPage(card)) {
            for (const edge of ["owned_pages", "client_pages", "assigned_pages"]) {
                const pages = await graph({
                    token,
                    method: "GET",
                    path: `${bm}/${edge}`,
                    query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
                });
                if (!pages.ok || !(0, meta_whatsapp_portfolio_map_1.firstOwnedPageId)(pages.json))
                    continue;
                const merged = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({ fallback: card, ownedPages: pages.json });
                card.primaryPageId = merged.primaryPageId || card.primaryPageId;
                card.primaryPageName = merged.primaryPageName || card.primaryPageName;
                card.profilePictureUrl = merged.profilePictureUrl || card.profilePictureUrl;
                break;
            }
        }
        if (card.primaryPageId && !card.primaryPageName) {
            const named = await (0, meta_whatsapp_portfolio_graph_1.fillPageNameById)(graph, token, bm, card);
            card.primaryPageId = named.primaryPageId || card.primaryPageId;
            card.primaryPageName = named.primaryPageName || card.primaryPageName;
            card.profilePictureUrl = named.profilePictureUrl || card.profilePictureUrl;
        }
        if (cardHasListedPage(card))
            return;
    }
}
function pageIdsFromGraphJson(json) {
    const ids = [];
    const add = (value) => {
        if (!value)
            return;
        if (Array.isArray(value)) {
            for (const item of value)
                add(item);
            return;
        }
        if (typeof value === "string" || typeof value === "number") {
            const id = String(value).trim();
            if (id && !ids.includes(id))
                ids.push(id);
            return;
        }
        if (typeof value !== "object")
            return;
        const rec = value;
        if (Array.isArray(rec.data)) {
            add(rec.data);
            return;
        }
        const id = String(rec.id || "").trim();
        if (id && !ids.includes(id))
            ids.push(id);
    };
    add(json);
    return ids;
}
async function listCardPageIds(graph, writeTokens, card) {
    const ids = [];
    const add = (value) => {
        const id = String(value || "").trim();
        if (id && !ids.includes(id))
            ids.push(id);
    };
    add(String(card.primaryPageId || ""));
    const bm = String(card.id || "").trim();
    if (!bm)
        return ids;
    for (const row of writeTokens) {
        const token = String(row.token || "").trim();
        if (!token)
            continue;
        const nested = await graph({
            token,
            method: "GET",
            path: bm,
            query: { fields: meta_whatsapp_portfolio_graph_1.META_BUSINESS_OWNED_PAGES_FIELDS },
        });
        if (nested.ok) {
            const rec = nested.json && typeof nested.json === "object" ? nested.json : {};
            for (const id of pageIdsFromGraphJson(rec.owned_pages))
                add(id);
            for (const id of pageIdsFromGraphJson(rec.client_pages))
                add(id);
        }
        for (const edge of ["owned_pages", "client_pages", "assigned_pages"]) {
            const pages = await graph({
                token,
                method: "GET",
                path: `${bm}/${edge}`,
                query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
            });
            if (!pages.ok)
                continue;
            for (const id of pageIdsFromGraphJson(pages.json))
                add(id);
        }
    }
    return ids;
}
async function discoverWabasFromPageId(graph, writeTokens, pageId) {
    const id = String(pageId || "").trim();
    if (!id)
        return emptyPartnerBucket();
    const fieldSets = [
        `whatsapp_business_account{id,name,phone_numbers.limit(100){${meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_CATALOG_FIELDS}}}`,
        "whatsapp_business_account{id,name}",
        "whatsapp_business_account",
    ];
    for (const row of writeTokens) {
        const token = String(row.token || "").trim();
        if (!token)
            continue;
        for (const fields of fieldSets) {
            const res = await graph({
                token,
                method: "GET",
                path: id,
                query: { fields },
            });
            if (!res.ok || !res.json || typeof res.json !== "object")
                continue;
            const rec = res.json;
            const account = rec.whatsapp_business_account;
            const accountRec = account && typeof account === "object" ? account : {};
            const wabaId = String(accountRec.id || "").trim();
            if (!wabaId)
                continue;
            return {
                wabaIds: [wabaId],
                phones: takeWabaPhonesFromNode(account, wabaId),
            };
        }
    }
    return emptyPartnerBucket();
}
async function discoverWabasFromPortfolioPage(graph, writeTokens, card) {
    const pageIds = await listCardPageIds(graph, writeTokens, card);
    const merged = emptyPartnerBucket();
    for (const pageId of pageIds) {
        const found = await discoverWabasFromPageId(graph, writeTokens, pageId);
        for (const id of found.wabaIds) {
            if (!merged.wabaIds.includes(id))
                merged.wabaIds.push(id);
        }
        for (const phone of found.phones)
            merged.phones.push(phone);
        if (merged.wabaIds.length)
            break;
    }
    return merged;
}
function isCatalogOnlyPlaceholderCard(card, tenantId, priorityBusinessId, graphVisibleIds) {
    const bm = String(card.id || "").trim();
    if (!bm || !(0, meta_whatsapp_known_owned_wabas_1.isCatalogBackfillBusiness)(bm))
        return false;
    if (priorityBusinessId && (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(bm, priorityBusinessId))
        return false;
    if ((0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId).some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm)))
        return false;
    if (graphVisibleIds.some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm)))
        return false;
    return true;
}
function persistManualCardWaba(tenantId, card) {
    const bm = String(card.id || "").trim();
    const wabaId = String(card.wabaId || "").trim();
    if (!bm || !wabaId)
        return;
    if (!(0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId).some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm)))
        return;
    try {
        (0, meta_whatsapp_manual_business_store_1.addManualBusiness)(tenantId, bm, String(card.name || ""), wabaId);
    }
    catch {
        // Persistir WABA no card manual não pode abortar a listagem.
    }
}
/**
 * Cards da select (BM administrado / backfill / + ID) não passam por hydrateOpenConnection.
 * BM convidada: edge leve owned/client + client da agência por owner/on_behalf_of/nome/página.
 * WABA/números antes da página, para o card aberto não perder a Graph para o PAGE da Flaviane.
 */
async function fillEmptyAdminPortfolioCards(rawGraph, tenantId, cards, writeTokens, openRows = [], priorityBusinessId = "", graphVisibleIds = []) {
    if (!cards.length || !writeTokens.length)
        return cards;
    const graph = withInvitedDiscoverLimits(rawGraph);
    const out = cards.map((card) => ({ ...card, numbers: (card.numbers || []).slice() }));
    const empty = out.filter((card) => {
        const bm = String(card.id || "").trim();
        if (!bm || (0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenantId, bm))
            return false;
        return cardNeedsWabaOrNumbers(card) || !cardHasListedPage(card);
    });
    if (!empty.length)
        return out;
    const seedByToken = new Map();
    for (const row of writeTokens) {
        const token = String(row.token || "").trim();
        if (!token || seedByToken.has(token))
            continue;
        const [owned, agency, debug] = await Promise.all([
            collectOwnedWabasByBusinessFromMe(graph, token),
            collectAgencyClientWabasByOwner(graph, token),
            collectDebugWabasByOwner(graph, token),
        ]);
        seedByToken.set(token, {
            row,
            maps: [owned, agency.byOwner, debug.byOwner],
            byName: mergeNameBuckets(agency.byName, debug.byName),
        });
    }
    const priority = String(priorityBusinessId || "").trim();
    const rank = (card) => {
        const bm = String(card.id || "").trim();
        if (priority && (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(bm, priority))
            return 0;
        if ((0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId).some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm)))
            return 1;
        return 2;
    };
    const needsWaba = empty
        .filter((card) => cardNeedsWabaOrNumbers(card))
        .sort((left, right) => rank(left) - rank(right));
    const needsPage = empty.filter((card) => !cardHasListedPage(card));
    for (const card of empty) {
        const bm = String(card.id || "").trim();
        const ownConnectionId = connectionIdForPortfolioBusiness(openRows, bm);
        if (ownConnectionId && !card.connectionId)
            card.connectionId = ownConnectionId;
    }
    for (const card of needsWaba) {
        const bm = String(card.id || "").trim();
        const ownConnectionId = connectionIdForPortfolioBusiness(openRows, bm);
        const catalogOnly = isCatalogOnlyPlaceholderCard(card, tenantId, priority, graphVisibleIds);
        try {
            const isAgency = (0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm));
            if (isAgency && cardHasListedWaba(card))
                continue;
            for (const row of writeTokens) {
                const token = String(row.token || "").trim();
                if (!token)
                    continue;
                const pack = seedByToken.get(token);
                const storedWaba = String(card.wabaId || "").trim();
                let seed = storedWaba
                    ? { wabaIds: [storedWaba], phones: [] }
                    : emptyPartnerBucket();
                if (catalogOnly) {
                    seed = mergePartnerBuckets(bm, pack?.maps || [], []);
                    if (storedWaba && !seed.wabaIds.includes(storedWaba))
                        seed.wabaIds.unshift(storedWaba);
                    if (!seed.wabaIds.length) {
                        const named = partnerBucketForCardName(pack?.byName, String(card.name || card.primaryPageName || ""));
                        seed = {
                            wabaIds: [...named.wabaIds],
                            phones: [...seed.phones, ...named.phones],
                        };
                    }
                    if (!seed.wabaIds.length && !seed.phones.length)
                        continue;
                }
                else {
                    const invited = await collectInvitedBusinessWabaRefs(graph, token, bm);
                    seed = mergeInvitedRefsIntoSeed(mergePartnerBuckets(bm, pack?.maps || [], invited.childIds), bm, invited);
                    if (storedWaba && !seed.wabaIds.includes(storedWaba))
                        seed.wabaIds.unshift(storedWaba);
                    if (!seed.wabaIds.length) {
                        const named = partnerBucketForCardName(pack?.byName, String(card.name || card.primaryPageName || ""));
                        seed = {
                            wabaIds: [...named.wabaIds],
                            phones: [...seed.phones, ...named.phones],
                        };
                    }
                    if (!seed.wabaIds.length) {
                        if (!cardHasListedPage(card))
                            await fillEmptyCardPageFromGraph(graph, writeTokens, card);
                        const fromPage = await discoverWabasFromPortfolioPage(graph, writeTokens, card);
                        seed = {
                            wabaIds: [...fromPage.wabaIds],
                            phones: [...seed.phones, ...fromPage.phones],
                        };
                    }
                }
                const fanout = await fanOutAdminBusinessNumbers({
                    graph,
                    token: row.token,
                    writeTokens,
                    businessId: bm,
                    seed,
                });
                if (applyDiscoveredWabasToCard(card, {
                    wabaIds: fanout.wabaIds.length ? fanout.wabaIds : seed.wabaIds,
                    phones: fanout.phones,
                    connectionId: ownConnectionId,
                })) {
                    persistManualCardWaba(tenantId, card);
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-admin-fanout", {
                        tenantId,
                        businessId: bm,
                        wabaCount: fanout.wabaIds.length || seed.wabaIds.length,
                        phoneRowCount: (card.numbers || []).length,
                    });
                }
                const pendingOnCard = (card.numbers || []).filter((item) => String(item.uiStatus || "") === "pendente");
                if (pendingOnCard.length) {
                    card.numbers = await confirmPendingPhoneStatusFromGraph(graph, writeTokens.map((item) => item.token), card.numbers || [], String(card.wabaId || "").trim());
                }
                if (cardHasListedNumbers(card) && cardHasListedWaba(card))
                    break;
            }
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-admin-fanout-failed", { tenantId, businessId: bm });
        }
    }
    for (const card of needsPage) {
        const bm = String(card.id || "").trim();
        if (isCatalogOnlyPlaceholderCard(card, tenantId, priority, graphVisibleIds))
            continue;
        try {
            await fillEmptyCardPageFromGraph(graph, writeTokens, card);
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-discover", {
                tenantId,
                businessId: bm,
                wabaId: card.wabaId || null,
                phoneRowCount: (card.numbers || []).length,
                hasPage: cardHasListedPage(card),
            });
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-admin-fanout-failed", { tenantId, businessId: bm });
        }
    }
    return out;
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
async function applyPhoneNameFields(graph, token, row, placeholderName) {
    if (row.nameStatus || row.newNameStatus) {
        const nameSync = (0, meta_whatsapp_portfolio_map_1.resolvePhoneNameSync)({
            verifiedName: row.verifiedName,
            nameStatus: row.nameStatus,
            newDisplayName: row.newDisplayName,
            newNameStatus: row.newNameStatus,
            placeholderName,
        });
        return {
            ...row,
            requestedName: nameSync.requestedName,
            nameSyncStatus: nameSync.nameSyncStatus,
            nameNeedsRegister: nameSync.nameNeedsRegister,
            canActivate: (0, meta_whatsapp_portfolio_map_1.canActivateMetaPhoneNumber)((0, meta_whatsapp_portfolio_map_1.resolveMetaPhoneUiStatus)({
                metaStatus: row.metaStatus,
                codeVerificationStatus: row.codeVerificationStatus,
                healthCanSend: row.healthCanSend,
                verifiedName: row.verifiedName,
            }), nameSync.nameNeedsRegister),
        };
    }
    const nameNode = await graph({
        token,
        method: "GET",
        path: row.phoneNumberId,
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
    const uiStatus = (0, meta_whatsapp_portfolio_map_1.resolveMetaPhoneUiStatus)({
        metaStatus: row.metaStatus,
        codeVerificationStatus: row.codeVerificationStatus,
        healthCanSend: row.healthCanSend,
        verifiedName,
    });
    return {
        ...row,
        verifiedName,
        nameStatus,
        newDisplayName,
        newNameStatus,
        requestedName: nameSync.requestedName,
        nameSyncStatus: nameSync.nameSyncStatus,
        nameNeedsRegister: nameSync.nameNeedsRegister,
        uiStatus,
        canActivate: (0, meta_whatsapp_portfolio_map_1.canActivateMetaPhoneNumber)(uiStatus, nameSync.nameNeedsRegister),
    };
}
async function attachPhoneNameStatuses(graph, token, numbers, placeholderName) {
    if (!numbers.length)
        return numbers;
    const limited = numbers.slice(0, 20);
    const rest = numbers.slice(20);
    const named = await Promise.all(limited.map((row) => applyPhoneNameFields(graph, token, row, placeholderName)));
    return rest.length ? named.concat(rest) : named;
}
async function attachPhoneBusinessProfiles(graph, token, numbers, tenantId, placeholderName) {
    if (!numbers.length)
        return numbers;
    const limited = numbers.slice(0, 20);
    const rest = numbers.slice(20);
    const withProfiles = await Promise.all(limited.map(async (row) => {
        const [named, profile] = await Promise.all([
            applyPhoneNameFields(graph, token, row, placeholderName),
            graph({
                token,
                method: "GET",
                path: `${row.phoneNumberId}/whatsapp_business_profile`,
                query: { fields: "about,address,description,email,profile_picture_url,vertical" },
            }),
        ]);
        const mapped = profile.ok ? (0, meta_whatsapp_phone_profile_1.mapWhatsappBusinessProfile)(profile.json) : null;
        const localPhoto = await cacheGraphPhonePhoto(tenantId, named.phoneNumberId, mapped?.profilePictureUrl || null);
        return {
            ...named,
            profilePictureUrl: localPhoto || (0, meta_whatsapp_portfolio_map_1.safePublicPhotoUrl)(mapped?.profilePictureUrl),
            vertical: mapped?.vertical ?? named.vertical,
            description: mapped?.description ?? named.description,
            address: mapped?.address ?? named.address,
            email: mapped?.email ?? named.email,
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
function queueOfficialPhoneDisplayName(graph, input) {
    void requestOfficialPhoneDisplayName(graph, input).catch(() => {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-skip", {
            tenantId: input.tenantId,
            reason: "queue",
        });
    });
}
async function requestOfficialPhoneDisplayName(graph, input) {
    rememberOfficialPhoneDisplayName(input.tenantId, input.phoneNumberId);
    const phoneId = String(input.phoneNumberId || "").trim();
    if (!phoneId || !input.token)
        return;
    try {
        const node = await graph({
            token: input.token,
            method: "GET",
            path: phoneId,
            query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NAME_FIELDS },
            maxAttempts: 1,
            timeoutMs: OFFICIAL_NAME_GRAPH_TIMEOUT_MS,
        });
        if (node.ok) {
            const names = (0, meta_whatsapp_portfolio_map_1.mapPhoneNameFields)(node.json);
            if ((0, meta_whatsapp_portfolio_map_1.namesEqual)(names.verifiedName, meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME) ||
                (0, meta_whatsapp_portfolio_map_1.namesEqual)(names.newDisplayName, meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME)) {
                return;
            }
        }
    }
    catch {
        // Sem o GET ainda tentamos o POST — o nome do chip antigo da conexão não vale.
    }
    const renamed = await graph({
        token: input.token,
        method: "POST",
        path: phoneId,
        query: { new_display_name: meta_whatsapp_phone_profile_1.META_WHATSAPP_DEFAULT_DISPLAY_NAME },
        maxAttempts: 1,
        timeoutMs: OFFICIAL_NAME_GRAPH_TIMEOUT_MS,
    });
    if (!renamed.ok) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-failed", {
            tenantId: input.tenantId,
            phoneNumberId: phoneId,
            status: renamed.status,
            graphCode: renamed.graphCode,
        });
        return;
    }
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-requested", {
        tenantId: input.tenantId,
        phoneNumberId: phoneId,
    });
}
function inboxPhoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
}
function inboxPhonesMatch(left, right) {
    const a = inboxPhoneDigits(left);
    const b = inboxPhoneDigits(right);
    if (!a || !b)
        return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
}
function pickInboxOpenConnection(input) {
    const preferred = input.preferredId
        ? input.rows.find((row) => row.id === input.preferredId)
        : undefined;
    if (preferred) {
        const preferredMatches = String(preferred.phoneNumberId || "").trim() === input.phoneNumberId ||
            inboxPhonesMatch(preferred.displayPhoneNumber, input.displayPhoneNumber);
        if (preferredMatches || !(0, meta_whatsapp_phone_identity_store_1.isConnectionAccountRestricted)(input.tenantId, preferred)) {
            return preferred;
        }
    }
    const byPhone = input.rows.find((row) => String(row.phoneNumberId || "").trim() === input.phoneNumberId) ||
        input.rows.find((row) => inboxPhonesMatch(row.displayPhoneNumber, input.displayPhoneNumber));
    if (byPhone)
        return byPhone;
    const unrestricted = input.rows.filter((row) => !(0, meta_whatsapp_phone_identity_store_1.isConnectionAccountRestricted)(input.tenantId, row));
    return unrestricted.length === 1 ? unrestricted[0] : null;
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
                try {
                    const token = this.decrypt(row.accessTokenEncrypted);
                    if (token) {
                        queueOfficialPhoneDisplayName(this.graph, {
                            token,
                            tenantId: tenant.tenantId,
                            phoneNumberId,
                        });
                    }
                }
                catch {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-skip", {
                        tenantId: tenant.tenantId,
                        reason: "attach",
                    });
                }
            }
            if (businessId) {
                (0, meta_whatsapp_hidden_business_store_1.unhideBusiness)(tenant.tenantId, businessId);
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
        if (open.status === "connected") {
            const connectedPhone = String(open.phoneNumberId || "").trim();
            if (connectedPhone) {
                try {
                    const token = this.decrypt(open.accessTokenEncrypted);
                    if (token) {
                        queueOfficialPhoneDisplayName(this.graph, {
                            token,
                            tenantId: tenant.tenantId,
                            phoneNumberId: connectedPhone,
                        });
                    }
                }
                catch {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-default-name-skip", {
                        tenantId: tenant.tenantId,
                        reason: "already_connected",
                    });
                }
            }
            return toMetaWhatsappPublicConnection(open);
        }
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
        queueOfficialPhoneDisplayName(this.graph, {
            token,
            tenantId: tenant.tenantId,
            phoneNumberId,
        });
        return toMetaWhatsappPublicConnection(connected);
    }
    async listPortfolioAssets(auth, opts) {
        const tenant = requireTenant(auth);
        const requested = String(opts?.connectionId || "").trim();
        const focusBusinessId = String(opts?.businessId || "").trim();
        const pending = (0, meta_whatsapp_portfolio_graph_cache_1.readPortfolioGraphInflight)(tenant.tenantId);
        if (opts?.fresh && !pending)
            (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        const storedPromise = this.loadStoredPortfolioAssets(tenant.tenantId, requested);
        const localize = (raw) => localizeAndHidePortfolioAssets(tenant.tenantId, raw);
        const canUseStoredFast = (stored) => !opts?.fresh &&
            assetsHaveListedNumbers(stored) &&
            !focusedBusinessNeedsWaba(stored, focusBusinessId) &&
            !listedNumbersNeedGraphStatus(stored);
        if (pending) {
            const stored = await storedPromise;
            if (canUseStoredFast(stored)) {
                const fast = await raceWithTimeout(pending, LIST_FAST_STORED_MS);
                if (fast) {
                    return localize(assetsFromPortfolioCards(fast.portfolios || [], requested));
                }
                void pending
                    .then((raw) => {
                    localize(assetsFromPortfolioCards(raw.portfolios || [], requested));
                })
                    .catch(() => undefined);
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-stored-fast", {
                    tenantId: tenant.tenantId,
                    reason: "inflight-numbers",
                });
                return localize(stored);
            }
            try {
                const raw = await pending;
                return localize(assetsFromPortfolioCards(raw.portfolios || [], requested));
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-graph-failed", { tenantId: tenant.tenantId, reason: "inflight" });
                return localize(stored);
            }
        }
        if ((0, meta_whatsapp_graph_cooldown_1.isMetaGraphUploadCooldown)()) {
            const stale = (0, meta_whatsapp_portfolio_graph_cache_1.readStaleCachedPortfolioGraph)(tenant.tenantId);
            if (stale?.portfolios?.length) {
                return localize(assetsFromPortfolioCards(stale.portfolios, requested));
            }
            return localize(await storedPromise);
        }
        const useCache = (0, meta_whatsapp_portfolio_graph_cache_1.shouldUsePortfolioGraphCache)() && !opts?.fresh;
        if (useCache) {
            const cached = (0, meta_whatsapp_portfolio_graph_cache_1.readCachedPortfolioGraph)(tenant.tenantId);
            if (cached?.portfolios?.length &&
                assetsHaveListedNumbers(cached) &&
                !focusedBusinessNeedsWaba(cached, focusBusinessId)) {
                return localize(assetsFromPortfolioCards(cached.portfolios, requested));
            }
        }
        const loaded = this.loadPortfolioGraphAssets(tenant.tenantId, requested, tenant.ownerEmail, focusBusinessId);
        const work = loaded.then((row) => row.assets);
        (0, meta_whatsapp_portfolio_graph_cache_1.setPortfolioGraphInflight)(tenant.tenantId, work);
        void loaded
            .then((row) => {
            localize(row.assets);
            if ((0, meta_whatsapp_portfolio_graph_cache_1.shouldUsePortfolioGraphCache)() && !row.graphPartial && assetsHaveListedNumbers(row.assets)) {
                (0, meta_whatsapp_portfolio_graph_cache_1.writeCachedPortfolioGraph)(tenant.tenantId, row.assets);
            }
        })
            .catch(() => undefined);
        void work.finally(() => {
            (0, meta_whatsapp_portfolio_graph_cache_1.clearPortfolioGraphInflight)(tenant.tenantId);
        }).catch(() => undefined);
        try {
            const stored = await storedPromise;
            if (canUseStoredFast(stored)) {
                const fast = await raceWithTimeout(work, LIST_FAST_STORED_MS);
                if (fast)
                    return localize(fast);
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-stored-fast", {
                    tenantId: tenant.tenantId,
                    reason: "graph-numbers",
                });
                return localize(stored);
            }
            const assets = await work;
            return localize(assets);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-graph-failed", { tenantId: tenant.tenantId, reason: "graph" });
            return localize(await this.loadStoredPortfolioAssets(tenant.tenantId, requested));
        }
    }
    /**
     * GET {business-id} com o token já conectado e guarda o ID para o Atualizar.
     * Sem WABA inventada — o card pode ficar vazio até colar o ID da WABA.
     */
    async addManualPortfolioBusiness(auth, rawBusinessId, rawWabaId = "") {
        const tenant = requireTenant(auth);
        const businessId = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(rawBusinessId);
        const pastedWabaId = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(rawWabaId);
        if (businessId.length < 6) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "Informe o ID numérico do portfólio (Business Manager).");
        }
        const existing = (0, meta_whatsapp_manual_business_store_1.listManualBusinesses)(tenant.tenantId).find((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(row.id, businessId));
        if (existing && pastedWabaId) {
            (0, meta_whatsapp_manual_business_store_1.addManualBusiness)(tenant.tenantId, businessId, existing.name, pastedWabaId);
            (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-manual-waba-attached", {
                tenantId: tenant.tenantId,
                businessId,
                wabaId: pastedWabaId,
            });
            return this.listPortfolioAssets(auth, { fresh: true, businessId });
        }
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenant.tenantId)
            : [await this.repository.findOpenByTenant(tenant.tenantId)].filter((item) => Boolean(item));
        const writeTokens = collectPortfolioWriteTokens(rows, this.decrypt);
        if (!writeTokens.length) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        let card = null;
        for (const row of writeTokens) {
            const token = String(row.token || "").trim();
            if (!token)
                continue;
            const fetched = await (0, meta_whatsapp_portfolio_graph_1.fetchBusinessFromGraph)(this.graph, token, businessId);
            if (fetched.card?.id && fetched.card.name) {
                card = fetched.card;
                break;
            }
            card = await (0, meta_whatsapp_portfolio_graph_1.fetchVisibleBusinessCard)(this.graph, token, businessId);
            if (card?.id)
                break;
        }
        if (!card?.id || !card.name) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "A Meta não devolveu esse Business Manager com a conexão atual. Confira o ID e se sua conta administra esse BM.");
        }
        (0, meta_whatsapp_hidden_business_store_1.unhideBusiness)(tenant.tenantId, card.id);
        (0, meta_whatsapp_manual_business_store_1.addManualBusiness)(tenant.tenantId, card.id, card.name, pastedWabaId);
        (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-manual-business-added", {
            tenantId: tenant.tenantId,
            businessId: card.id,
            wabaId: pastedWabaId || null,
        });
        return this.listPortfolioAssets(auth, { fresh: true, businessId: card.id });
    }
    /**
     * Esconde o BM da lista do laboratório. O Atualizar não devolve o card.
     * Adicionar BM com o mesmo ID reexibe.
     */
    async hidePortfolioBusiness(auth, rawBusinessId) {
        const tenant = requireTenant(auth);
        const businessId = (0, meta_whatsapp_manual_business_store_1.normalizeManualBusinessId)(rawBusinessId);
        if (businessId.length < 6) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "Informe o ID numérico do portfólio (Business Manager).");
        }
        (0, meta_whatsapp_hidden_business_store_1.hideBusiness)(tenant.tenantId, businessId);
        const repo = this.repository;
        const openRows = typeof repo.listOpenByTenant === "function" ? await repo.listOpenByTenant(tenant.tenantId) : [];
        for (const row of openRows) {
            const phoneNumberId = String(row.phoneNumberId || "").trim();
            if (!phoneNumberId || !(0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), businessId))
                continue;
            try {
                (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
                    businessId,
                    portfolioHidden: true,
                    displayPhoneNumber: row.displayPhoneNumber || undefined,
                });
            }
            catch {
                // Ocultar o BM não pode falhar por identidade local.
            }
        }
        (0, meta_whatsapp_phone_identity_store_1.markPhoneIdentitiesRestrictedForBusiness)(tenant.tenantId, businessId, openRows);
        (0, meta_whatsapp_portfolio_graph_cache_1.invalidateCachedPortfolioGraph)(tenant.tenantId);
        const assets = await this.listPortfolioAssets(auth, { fresh: true });
        const card = (assets.portfolios || []).find((item) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(item.id || ""), businessId));
        if (card?.name)
            (0, meta_whatsapp_hidden_business_store_1.hideBusiness)(tenant.tenantId, businessId, card.name);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-business-hidden", {
            tenantId: tenant.tenantId,
            businessId,
        });
        return assets;
    }
    async persistInvitedPortfolioCards(input) {
        const repo = this.repository;
        if (typeof repo.ensureInvitedBusinessConnection !== "function")
            return;
        const source = input.rows.find((row) => input.writeTokens.some((token) => token.id === row.id)) || input.rows[0];
        if (!source || !String(source.accessTokenEncrypted || "").trim())
            return;
        for (const card of input.cards) {
            const bm = String(card.id || "").trim();
            if (!bm || card.hidden || (0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(input.tenantId, bm))
                continue;
            if ((0, meta_whatsapp_known_owned_wabas_1.catalogAgencyBusinessIds)().some((id) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(id, bm)))
                continue;
            const wabaId = String(card.wabaId || "").trim() ||
                String((card.numbers || []).map((row) => row.wabaId).find(Boolean) || "").trim();
            const phone = (card.numbers || []).find((row) => String(row.displayPhoneNumber || row.phoneNumberId || "").trim());
            if (!wabaId && !phone)
                continue;
            persistManualCardWaba(input.tenantId, { ...card, wabaId: wabaId || card.wabaId });
            const already = input.rows.find((row) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(row.metaBusinessId || ""), bm));
            if (already?.id) {
                card.connectionId = already.id;
                if (already.wabaId || !wabaId)
                    continue;
            }
            try {
                const before = already || (await repo.findByBusinessId(input.tenantId, bm));
                const saved = await repo.ensureInvitedBusinessConnection({
                    tenantId: input.tenantId,
                    ownerEmail: input.ownerEmail,
                    actorEmail: input.actorEmail,
                    metaBusinessId: bm,
                    wabaId: wabaId || null,
                    phoneNumberId: phone?.phoneNumberId || null,
                    displayPhoneNumber: phone?.displayPhoneNumber || null,
                    verifiedName: phone?.verifiedName || null,
                    accessTokenEncrypted: source.accessTokenEncrypted,
                    tokenType: source.tokenType,
                    tokenExpiresAt: source.tokenExpiresAt,
                });
                card.connectionId = saved.id;
                const created = !before;
                const attachedWaba = Boolean(wabaId) && !String(before?.wabaId || "").trim();
                if (created || attachedWaba) {
                    await this.syncInvitedBusinessTemplates({
                        tenantId: input.tenantId,
                        connection: saved,
                        token: input.writeTokens.find((row) => row.id === source.id)?.token || "",
                        wabaId: String(saved.wabaId || wabaId || "").trim(),
                    });
                }
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-business-connected", {
                    tenantId: input.tenantId,
                    businessId: bm,
                    wabaId: saved.wabaId,
                    created,
                });
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-business-connect-failed", {
                    tenantId: input.tenantId,
                    businessId: bm,
                });
            }
        }
    }
    async syncInvitedBusinessTemplates(input) {
        const wabaId = String(input.wabaId || "").trim();
        const token = String(input.token || "").trim();
        if (!wabaId || !token)
            return;
        try {
            const listed = await (0, meta_whatsapp_template_graph_client_1.listWabaMessageTemplates)({
                token,
                wabaId,
                graph: (req) => this.graph({
                    token: req.token,
                    method: "GET",
                    path: req.path,
                    query: req.query,
                    body: req.body,
                    maxAttempts: req.maxAttempts,
                    timeoutMs: req.timeoutMs,
                }),
                timeoutMs: 8000,
                maxPages: 5,
            });
            if (!listed.ok)
                return;
            const templates = new meta_whatsapp_template_repository_1.MetaWhatsappTemplateRepository();
            const now = new Date().toISOString();
            for (const item of listed.items) {
                if (!item)
                    continue;
                await templates.upsertFromGraph({
                    tenantId: input.tenantId,
                    connectionId: input.connection.id,
                    wabaId,
                    metaTemplateId: item.metaTemplateId,
                    name: item.name,
                    language: item.language,
                    category: item.category,
                    status: item.status,
                    components: item.components,
                    qualityScore: item.qualityScore,
                    rejectedReason: item.rejectedReason,
                    lastSyncedAt: now,
                });
            }
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-templates-synced", {
                tenantId: input.tenantId,
                wabaId,
                count: listed.items.filter(Boolean).length,
            });
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-invited-templates-sync-failed", {
                tenantId: input.tenantId,
                wabaId,
            });
        }
    }
    async loadStoredPortfolioAssets(tenantId, requested) {
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenantId)
            : [await this.repository.findOpenByTenant(tenantId)].filter((item) => Boolean(item));
        const cards = seedKnownPortfolioCards(tenantId, rows.map((row) => ({ ...cardFromConnection(row), numbers: storedNumbersFromConnection(row) })));
        return assetsFromPortfolioCards(cards, requested);
    }
    async loadPortfolioGraphAssets(tenantId, requested, actorEmail = "", priorityBusinessId = "") {
        const repo = this.repository;
        if (typeof repo.reopenLeftManagerForBusinesses === "function") {
            try {
                const restored = await repo.reopenLeftManagerForBusinesses(tenantId, [
                    ...(0, meta_whatsapp_known_owned_wabas_1.businessIdsToReopenAfterFalseLeftManager)(),
                    ...(0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId),
                    ...(0, meta_whatsapp_hidden_business_store_1.listHiddenBusinessIds)(tenantId),
                ], actorEmail);
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
                assets: {
                    portfolios: [],
                    selectedConnectionId: null,
                    portfolio: null,
                    numbers: [],
                },
                graphPartial: false,
            };
        }
        const writeTokens = collectPortfolioWriteTokens(rows, this.decrypt);
        const selectPage = await collectSelectPageAdminCards({
            graph: withHydrateLimits(this.graph),
            writeTokens,
            extraBusinessIds: [...(0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId), ...(0, meta_whatsapp_hidden_business_store_1.listHiddenBusinessIds)(tenantId)],
        });
        const hydrated = await Promise.all(rows.map((row) => hydrateOpenConnection(this.graph, this.decrypt, tenantId, row, (0, meta_whatsapp_template_waba_ids_1.extraWabaIdsFromConnections)(rows, row), writeTokens, { assignedJson: selectPage.assignedByConnectionId.get(row.id) })));
        const leftIds = hydrated
            .filter((item) => item.leftManager)
            .map((item) => String(item.connectionId || "").trim())
            .filter(Boolean);
        const kept = hydrated.filter((item) => !item.leftManager);
        const fromConnections = kept.map((item) => item.card);
        const fromDirectory = kept.flatMap((item) => item.directory || []);
        const merged = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)([
            ...selectPage.cards,
            ...fromConnections,
            ...fromDirectory,
        ]);
        let graphPartial = hydrated.some((item) => item.hydratePartial);
        const seeds = seedKnownPortfolioCards(tenantId, merged);
        const cards = await fillEmptyAdminPortfolioCards(this.graph, tenantId, seeds, writeTokens, rows, priorityBusinessId, merged.map((card) => String(card.id || "").trim()).filter(Boolean));
        if ((0, meta_whatsapp_manual_business_store_1.listManualBusinessIds)(tenantId).some((id) => cards.some((card) => (0, meta_whatsapp_known_owned_wabas_1.metaBusinessIdsMatch)(String(card.id || ""), id) &&
            card.hidden !== true &&
            cardNeedsWabaOrNumbers(card))) ||
            focusedBusinessNeedsWaba({ portfolios: cards, selectedConnectionId: null, portfolio: null, numbers: [] }, priorityBusinessId)) {
            graphPartial = true;
        }
        await this.persistInvitedPortfolioCards({
            tenantId,
            ownerEmail: actorEmail,
            actorEmail,
            rows,
            writeTokens,
            cards,
        });
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
            graphPartial,
        });
        return { assets: raw, graphPartial };
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
        try {
            (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, { uiStatus: "ativo" });
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-identity-skip", { tenantId: tenant.tenantId });
        }
        if (open.wabaId && open.phoneNumberId && open.status !== "connected" && rows[0]?.id === open.id) {
            try {
                await this.confirmFromAuth(auth);
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-confirm-skip", { tenantId: tenant.tenantId });
            }
        }
        queueOfficialPhoneDisplayName(this.graph, {
            token,
            tenantId: tenant.tenantId,
            phoneNumberId,
        });
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
        const current = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenant.tenantId, phoneNumberId);
        const openRows = await this.repository.listOpenByTenant(tenant.tenantId);
        const preferredId = String(input.connectionId || "").trim();
        const requestedDisplay = String(input.displayPhoneNumber || "").trim() || current?.displayPhoneNumber || null;
        const open = pickInboxOpenConnection({
            tenantId: tenant.tenantId,
            rows: openRows,
            preferredId,
            phoneNumberId,
            displayPhoneNumber: requestedDisplay,
        });
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        if (input.enabled) {
            const linkedBusinessId = String(open.metaBusinessId || current?.businessId || "").replace(/\D/g, "");
            if (current?.portfolioHidden === true ||
                (linkedBusinessId && (0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenant.tenantId, linkedBusinessId))) {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "Este número está em Restritas. Só é possível ligar o Inbox em chip Ativo.");
            }
            if (current?.uiStatus === "pendente" || current?.uiStatus === "restrito") {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "Só é possível ligar o Inbox em número Ativo, sem restrição ou desativado.");
            }
        }
        const displayPhoneNumber = String(input.displayPhoneNumber || "").trim() ||
            current?.displayPhoneNumber ||
            open.displayPhoneNumber ||
            null;
        if (input.enabled && (0, meta_whatsapp_known_owned_wabas_1.isWithdrawnInboxDisplayPhone)(displayPhoneNumber)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload", 400, "Este número não entra no Atendimento: a conta WhatsApp integrada foi restrita.");
        }
        const channelName = String(input.channelName || "").trim() ||
            current?.channelName ||
            open.verifiedName ||
            null;
        const rawBusinessId = String(open.metaBusinessId || "").replace(/\D/g, "") || null;
        const stampBusinessId = rawBusinessId &&
            !(0, meta_whatsapp_hidden_business_store_1.isHiddenBusiness)(tenant.tenantId, rawBusinessId) &&
            !(0, meta_whatsapp_phone_identity_store_1.isConnectionAccountRestricted)(tenant.tenantId, open)
            ? rawBusinessId
            : null;
        const saved = (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
            inboxEnabled: input.enabled,
            displayPhoneNumber,
            channelName,
            businessId: stampBusinessId,
            ...(input.enabled && !current?.uiStatus ? { uiStatus: "ativo" } : {}),
        });
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-inbox-updated", { tenantId: tenant.tenantId, enabled: input.enabled });
        return {
            phoneNumberId,
            inboxEnabled: input.enabled,
            displayPhoneNumber: saved.displayPhoneNumber,
            channelName: saved.channelName,
        };
    }
    async setPhoneBotFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const phoneNumberId = String(input.phoneNumberId || "").trim();
        if (!phoneNumberId || typeof input.enabled !== "boolean") {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const current = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenant.tenantId, phoneNumberId);
        const displayPhoneNumber = String(input.displayPhoneNumber || "").trim() || current?.displayPhoneNumber || null;
        const channelName = String(input.channelName || "").trim() || current?.channelName || null;
        const saved = (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
            botEnabled: input.enabled,
            displayPhoneNumber,
            channelName,
        });
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-bot-updated", { tenantId: tenant.tenantId, enabled: input.enabled });
        return {
            phoneNumberId,
            botEnabled: input.enabled,
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
