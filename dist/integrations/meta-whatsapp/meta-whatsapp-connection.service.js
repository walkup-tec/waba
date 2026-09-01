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
const meta_whatsapp_portfolio_graph_1 = require("./meta-whatsapp-portfolio-graph");
const meta_whatsapp_portfolio_identity_store_1 = require("./meta-whatsapp-portfolio-identity.store");
const meta_whatsapp_phone_identity_store_1 = require("./meta-whatsapp-phone-identity.store");
const meta_whatsapp_phone_profile_1 = require("./meta-whatsapp-phone-profile");
const meta_whatsapp_resumable_upload_1 = require("./meta-whatsapp-resumable-upload");
const meta_whatsapp_webhook_subscription_service_1 = require("./meta-whatsapp-webhook-subscription.service");
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
    const localizeCard = (item) => (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioBusinessPhoto)(tenantId, item);
    const portfolio = assets.portfolio ? localizeCard(assets.portfolio) : null;
    const portfolios = (assets.portfolios || []).map((item) => ({
        ...localizeCard(item),
        numbers: (0, meta_whatsapp_phone_identity_store_1.applyLocalPhoneIdentities)(tenantId, item.numbers || []),
    }));
    return {
        ...assets,
        portfolios,
        selectedConnectionId: assets.selectedConnectionId ?? null,
        portfolio: portfolio,
        numbers: (0, meta_whatsapp_phone_identity_store_1.applyLocalPhoneIdentities)(tenantId, assets.numbers || []),
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
    };
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
async function hydrateOpenConnection(graph, decrypt, tenantId, open) {
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
        return { card: fallback, directory: [] };
    }
    const storedWaba = String(open.wabaId || "").trim();
    const storedBm = String(open.metaBusinessId || "").trim();
    const wabaLookup = storedWaba || storedBm;
    const waba = wabaLookup ? await (0, meta_whatsapp_portfolio_graph_1.fetchWabaOwner)(graph, token, wabaLookup) : { hint: { wabaId: null, wabaName: null, businessId: null, businessName: null, primaryPageId: null, primaryPageName: null, profilePictureUrl: null }, json: null, ok: false };
    if (wabaLookup && !waba.ok) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
            tenantId,
            reason: "waba-identity",
            connectionId: open.id,
        });
    }
    const hint = waba.hint;
    const resolvedWaba = storedWaba ||
        (hint.businessId && hint.wabaId && hint.wabaId !== hint.businessId ? hint.wabaId : "");
    const resolvedBm = hint.businessId || (0, meta_whatsapp_portfolio_map_1.businessIdNotWaba)(storedBm, resolvedWaba || storedWaba) || "";
    const [assignedJson, fetchedBm] = await Promise.all([
        (0, meta_whatsapp_portfolio_graph_1.fetchAssignedBusinesses)(graph, token),
        resolvedBm
            ? (0, meta_whatsapp_portfolio_graph_1.fetchBusinessFromGraph)(graph, token, resolvedBm)
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
        waba: waba.json || fetchedBm.wabaJson,
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
            wabaId: graphCard.wabaId || card.wabaId || resolvedWaba || storedWaba,
            connectionId: open.id,
        };
    }
    card = {
        ...card,
        primaryPageId: card.primaryPageId || hint.primaryPageId,
        primaryPageName: card.primaryPageName || hint.primaryPageName,
    };
    const photoDownloadUrl = fetchedBm.photoDownloadUrl ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(matched) ||
        (0, meta_whatsapp_portfolio_map_1.graphPhotoDownloadUrl)(waba.json) ||
        card.profilePictureUrl;
    const localPhoto = await cacheGraphBusinessPhoto(tenantId, card.id, photoDownloadUrl);
    card = {
        ...card,
        profilePictureUrl: localPhoto || card.profilePictureUrl,
        wabaId: card.wabaId || resolvedWaba || storedWaba,
    };
    const wabaId = resolvedWaba || storedWaba;
    if (!wabaId)
        return { card, directory };
    const phones = await graph({
        token,
        method: "GET",
        path: `${wabaId}/phone_numbers`,
        query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NUMBER_LIST_FIELDS },
    });
    if (!phones.ok) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
            tenantId,
            reason: "phones",
            status: phones.status,
            connectionId: open.id,
        });
        return { card, directory };
    }
    const mapped = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)(phones.json);
    const merged = (0, meta_whatsapp_portfolio_map_1.mergePortfolioNumbers)(mapped, stored);
    const numbers = await attachPhoneBusinessProfiles(graph, token, merged, tenantId);
    return { card: { ...card, numbers }, directory };
}
async function cacheGraphPhonePhoto(tenantId, phoneNumberId, url) {
    const local = (0, meta_whatsapp_phone_identity_store_1.localPhonePhotoUrl)(phoneNumberId, (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenantId, phoneNumberId));
    if (process.env.NODE_TEST_CONTEXT)
        return local;
    if (!url || !/^https:\/\//i.test(url))
        return local;
    const identity = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenantId, phoneNumberId);
    const nextKey = (0, meta_whatsapp_portfolio_map_1.graphPhotoSourceKey)(url);
    if (identity?.photoExt && identity.photoSource && nextKey && identity.photoSource === nextKey) {
        return (0, meta_whatsapp_phone_identity_store_1.localPhonePhotoUrl)(phoneNumberId, identity);
    }
    const downloaded = await (0, meta_whatsapp_phone_profile_1.fetchHttpsProfileImage)(url);
    if (!downloaded)
        return local;
    const saved = (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenantId, phoneNumberId, {
        photo: downloaded,
        photoSource: nextKey,
        photoMetaApplied: true,
    });
    return (0, meta_whatsapp_phone_identity_store_1.localPhonePhotoUrl)(phoneNumberId, saved) || local;
}
async function attachPhoneBusinessProfiles(graph, token, numbers, tenantId) {
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
            canActivate: !(0, meta_whatsapp_portfolio_map_1.isMetaPhoneConnected)(row.metaStatus) || nameSync.nameNeedsRegister,
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
        const open = (incomingBusinessId
            ? await this.repository.findByBusinessId(tenant.tenantId, incomingBusinessId)
            : null) ??
            (await this.repository.latestPendingToken(tenant.tenantId));
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
        const phone = await this.graph({
            token,
            method: "GET",
            path: phoneNumberId,
            query: { fields: "id,display_phone_number,verified_name,quality_rating,whatsapp_business_account" },
        });
        if (!phone.ok) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("graph-validation-failed", {
                tenantId: tenant.tenantId,
                reason: "phone",
                status: phone.status,
            });
            if (phone.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            throw new meta_whatsapp_errors_1.MetaWhatsappError("persist_failed");
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
        return toMetaWhatsappPublicConnection(connected);
    }
    async listPortfolioAssets(auth, opts) {
        const tenant = requireTenant(auth);
        const repo = this.repository;
        const rows = typeof repo.listOpenByTenant === "function"
            ? await repo.listOpenByTenant(tenant.tenantId)
            : [await this.repository.findOpenByTenant(tenant.tenantId)].filter((item) => Boolean(item));
        if (!rows.length) {
            return withLocalIdentities(tenant.tenantId, {
                portfolios: [],
                selectedConnectionId: null,
                portfolio: null,
                numbers: [],
            });
        }
        const requested = String(opts?.connectionId || "").trim();
        const hydrated = await Promise.all(rows.map((row) => hydrateOpenConnection(this.graph, this.decrypt, tenant.tenantId, row)));
        const cards = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)(hydrated.map((item) => item.card));
        const selected = cards.find((item) => item.connectionId === requested) ||
            cards.find((item) => item.id && item.id === String(opts?.connectionId || "").trim()) ||
            cards[0];
        const selectedNumbers = selected?.numbers || [];
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-listed", {
            tenantId: tenant.tenantId,
            hasBusiness: Boolean(selected?.id),
            numbers: selectedNumbers.length,
        });
        return withLocalIdentities(tenant.tenantId, {
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
        });
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
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const registered = await this.graph({
            token,
            method: "POST",
            path: `${phoneNumberId}/register`,
            body: { messaging_product: "whatsapp", pin },
        });
        if (!registered.ok) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-failed", {
                tenantId: tenant.tenantId,
                reason: "graph",
                status: registered.status,
            });
            if (registered.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            throw new meta_whatsapp_errors_1.MetaWhatsappError("register_failed");
        }
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-registered", {
            tenantId: tenant.tenantId,
            connectionId: open.id,
        });
        if (open.wabaId && open.phoneNumberId && open.status !== "connected" && rows[0]?.id === open.id) {
            try {
                await this.confirmFromAuth(auth);
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-confirm-skip", { tenantId: tenant.tenantId });
            }
        }
        return this.listPortfolioAssets(auth);
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
