"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappConnectionService = void 0;
exports.toMetaWhatsappUiStatus = toMetaWhatsappUiStatus;
exports.toMetaWhatsappPublicConnection = toMetaWhatsappPublicConnection;
exports.stripMetaSecrets = stripMetaSecrets;
const meta_config_1 = require("./meta-config");
const meta_token_crypto_1 = require("./meta-token-crypto");
const meta_whatsapp_oauth_1 = require("./meta-whatsapp-oauth");
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_portfolio_map_1 = require("./meta-whatsapp-portfolio.map");
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
    const many = (assets.portfolios || []).length > 1;
    const localizeCard = (item) => many ? item : (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioIdentity)(tenantId, item);
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
    if (!phoneNumberId && !display)
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
            canActivate: false,
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
    const page = String(open.verifiedName || "").trim() || null;
    return {
        id: (0, meta_whatsapp_portfolio_map_1.businessIdNotWaba)(open.metaBusinessId, open.wabaId),
        name: page,
        primaryPageId: null,
        primaryPageName: page,
        profilePictureUrl: null,
        wabaId: open.wabaId,
        connectionId: open.id,
    };
}
async function fetchBusinessIdentity(graph, token, businessId) {
    const rich = await graph({
        token,
        method: "GET",
        path: businessId,
        query: { fields: meta_whatsapp_portfolio_map_1.META_BUSINESS_IDENTITY_FIELDS },
    });
    if (rich.ok || rich.status === 401)
        return rich;
    return graph({
        token,
        method: "GET",
        path: businessId,
        query: { fields: meta_whatsapp_portfolio_map_1.META_BUSINESS_IDENTITY_FIELDS_MINIMAL },
    });
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
        return fallback;
    }
    const storedWaba = String(open.wabaId || "").trim();
    const storedBm = String(open.metaBusinessId || "").trim();
    const wabaLookup = storedWaba || storedBm;
    let wabaJson;
    if (wabaLookup) {
        const wabaRes = await graph({
            token,
            method: "GET",
            path: wabaLookup,
            query: { fields: meta_whatsapp_portfolio_map_1.META_WABA_IDENTITY_FIELDS },
        });
        if (wabaRes.ok)
            wabaJson = wabaRes.json;
        else if (wabaRes.status !== 401) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
                tenantId,
                reason: "waba-identity",
                status: wabaRes.status,
                connectionId: open.id,
            });
        }
        else {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
                tenantId,
                reason: "waba-401",
                connectionId: open.id,
            });
        }
    }
    const hint = (0, meta_whatsapp_portfolio_map_1.mapMetaWabaIdentity)(wabaJson);
    const resolvedWaba = storedWaba ||
        (hint.businessId && hint.wabaId && hint.wabaId !== hint.businessId ? hint.wabaId : "");
    const resolvedBm = hint.businessId || (0, meta_whatsapp_portfolio_map_1.businessIdNotWaba)(storedBm, resolvedWaba || storedWaba) || "";
    let businessJson;
    if (resolvedBm) {
        const business = await fetchBusinessIdentity(graph, token, resolvedBm);
        if (business.ok)
            businessJson = business.json;
        else if (business.status !== 401) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
                tenantId,
                reason: "business",
                status: business.status,
                connectionId: open.id,
            });
        }
        else {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
                tenantId,
                reason: "business-401",
                connectionId: open.id,
            });
        }
    }
    let card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
        fallback,
        business: businessJson,
        waba: wabaJson,
    });
    if (!card.primaryPageName && resolvedBm) {
        const pages = await graph({
            token,
            method: "GET",
            path: `${resolvedBm}/owned_pages`,
            query: { fields: meta_whatsapp_portfolio_map_1.META_OWNED_PAGES_FIELDS },
        });
        if (pages.ok) {
            card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
                fallback: card,
                business: businessJson,
                waba: wabaJson,
                ownedPages: pages.json,
            });
        }
    }
    if (!card.profilePictureUrl && resolvedBm) {
        const picture = await graph({
            token,
            method: "GET",
            path: `${resolvedBm}/picture`,
            query: { redirect: "0", type: "large" },
        });
        if (picture.ok) {
            card = (0, meta_whatsapp_portfolio_map_1.mergePortfolioIdentity)({
                fallback: card,
                business: businessJson,
                waba: wabaJson,
                picture: picture.json,
            });
        }
    }
    const wabaId = resolvedWaba || storedWaba;
    if (!wabaId)
        return card;
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
        return card;
    }
    const mapped = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)(phones.json);
    const merged = (0, meta_whatsapp_portfolio_map_1.mergePortfolioNumbers)(mapped, stored);
    const numbers = await attachPhoneBusinessProfiles(graph, token, merged, tenantId);
    return { ...card, numbers };
}
const PHOTO_GRAPH_GRACE_MS = 90000;
async function cacheGraphPhonePhoto(tenantId, phoneNumberId, url) {
    if (process.env.NODE_TEST_CONTEXT)
        return;
    if (!url || !/^https:\/\//i.test(url))
        return;
    const identity = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenantId, phoneNumberId);
    if (identity?.photoExt && identity.photoMetaApplied) {
        const age = Date.now() - Date.parse(identity.updatedAt);
        if (Number.isFinite(age) && age >= 0 && age < PHOTO_GRAPH_GRACE_MS)
            return;
    }
    const downloaded = await (0, meta_whatsapp_phone_profile_1.fetchHttpsProfileImage)(url);
    if (!downloaded)
        return;
    (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenantId, phoneNumberId, {
        photo: downloaded,
        photoMetaApplied: true,
    });
}
async function attachPhoneBusinessProfiles(graph, token, numbers, tenantId) {
    if (!numbers.length)
        return numbers;
    const limited = numbers.slice(0, 20);
    const rest = numbers.slice(20);
    const withProfiles = await Promise.all(limited.map(async (row) => {
        const nameNode = await graph({
            token,
            method: "GET",
            path: row.phoneNumberId,
            query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NAME_FIELDS },
        });
        const profile = await graph({
            token,
            method: "GET",
            path: `${row.phoneNumberId}/whatsapp_business_profile`,
            query: { fields: "about,address,description,email,profile_picture_url,vertical" },
        });
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
        await cacheGraphPhonePhoto(tenantId, row.phoneNumberId, mapped?.profilePictureUrl || null);
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
            profilePictureUrl: null,
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
class MetaWhatsappConnectionService {
    constructor(repository = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), oauth = { exchangeEmbeddedSignupCode: meta_whatsapp_oauth_1.exchangeEmbeddedSignupCode }, graph = (input) => (0, meta_whatsapp_graph_client_1.callMetaGraphJson)(input), decrypt = meta_token_crypto_1.decryptMetaToken, uploadImage = meta_whatsapp_resumable_upload_1.uploadMetaResumableImage, setPagePicture = meta_whatsapp_resumable_upload_1.publishMetaPageProfilePicture) {
        this.repository = repository;
        this.oauth = oauth;
        this.graph = graph;
        this.decrypt = decrypt;
        this.uploadImage = uploadImage;
        this.setPagePicture = setPagePicture;
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
        const hydrated = [];
        for (const row of rows) {
            hydrated.push(await hydrateOpenConnection(this.graph, this.decrypt, tenant.tenantId, row));
        }
        const cards = (0, meta_whatsapp_portfolio_map_1.dedupePortfolioCards)(hydrated);
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
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const phoneNumberId = String(input.phoneNumberId || open.phoneNumberId || "").trim();
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
        if (open.wabaId && open.phoneNumberId && open.status !== "connected") {
            try {
                await this.confirmFromAuth(auth);
            }
            catch {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-register-confirm-skip", { tenantId: tenant.tenantId });
            }
        }
        return this.listPortfolioAssets(auth);
    }
    async updatePhoneProfileFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const phoneNumberId = String(input.phoneNumberId || "").trim();
        const displayName = (0, meta_whatsapp_phone_profile_1.parseDisplayName)(input.displayName);
        const photo = (0, meta_whatsapp_phone_profile_1.parseProfilePhoto)({ photoBase64: input.photoBase64, photoMime: input.photoMime });
        const vertical = (0, meta_whatsapp_phone_profile_1.parseVertical)(input.vertical);
        const description = (0, meta_whatsapp_phone_profile_1.parseDescription)(input.description);
        const address = (0, meta_whatsapp_phone_profile_1.parseAddress)(input.address);
        const email = (0, meta_whatsapp_phone_profile_1.parseEmail)(input.email);
        if (vertical === null || description === null || address === null || email === null) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const hasBiz = vertical !== undefined || description !== undefined || address !== undefined || email !== undefined;
        if (!phoneNumberId || (!displayName && !photo && !hasBiz)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const assets = await this.listPortfolioAssets(auth);
        const numberRow = assets.numbers.find((row) => row.phoneNumberId === phoneNumberId);
        if (!numberRow) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        const connected = (0, meta_whatsapp_portfolio_map_1.isMetaPhoneConnected)(numberRow.metaStatus);
        if (!connected) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                tenantId: tenant.tenantId,
                reason: "not_registered",
            });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("phone_not_registered");
        }
        let namePending = false;
        let nameNeedsRegister = false;
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
                if (renamed.status === 401)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_update_failed");
            }
            const nameNode = await this.graph({
                token,
                method: "GET",
                path: phoneNumberId,
                query: { fields: meta_whatsapp_portfolio_map_1.META_PHONE_NAME_FIELDS },
            });
            const named = nameNode.ok ? (0, meta_whatsapp_portfolio_map_1.mapPhoneNameFields)(nameNode.json) : {
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
        const profileBody = { messaging_product: "whatsapp" };
        if (vertical)
            profileBody.vertical = vertical;
        if (description)
            profileBody.description = description;
        if (address)
            profileBody.address = address;
        if (email)
            profileBody.email = email;
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
                throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_update_failed");
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
                throw new meta_whatsapp_errors_1.MetaWhatsappError("profile_update_failed");
            }
        }
        (0, meta_whatsapp_phone_identity_store_1.writePhoneIdentity)(tenant.tenantId, phoneNumberId, {
            name: displayName || undefined,
            channelName: displayName || undefined,
            photo: photo
                ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
                : undefined,
            vertical: vertical !== undefined ? vertical || null : undefined,
            description: description !== undefined ? description : undefined,
            address: address !== undefined ? address : undefined,
            email: email !== undefined ? email || null : undefined,
            ...(profileBody.profile_picture_handle ? { photoMetaApplied: true } : {}),
            ...(vertical || description || address || email ? { profileMetaApplied: true } : {}),
        });
        const nameUpdated = Boolean(displayName);
        const photoUpdated = Boolean(photo);
        const profileUpdated = hasBiz || photoUpdated;
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-updated", {
            tenantId: tenant.tenantId,
            namePending,
            nameNeedsRegister,
            nameUpdated,
            photoUpdated,
            profileUpdated,
            metaWarning: false,
        });
        const listed = await this.listPortfolioAssets(auth);
        return {
            ...listed,
            namePending,
            nameNeedsRegister: nameNeedsRegister || listed.numbers.some((row) => row.phoneNumberId === phoneNumberId && row.nameNeedsRegister),
            nameUpdated,
            photoUpdated,
            profileUpdated,
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
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const current = (0, meta_whatsapp_phone_identity_store_1.readPhoneIdentity)(tenant.tenantId, phoneNumberId);
        const displayPhoneNumber = String(input.displayPhoneNumber || "").trim() ||
            current?.displayPhoneNumber ||
            open.displayPhoneNumber ||
            null;
        const channelName = current?.name ||
            String(input.channelName || "").trim() ||
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
    async subscribeWebhooksFromAuth(auth) {
        const tenant = requireTenant(auth);
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open?.wabaId ||
            (open.status !== "connected" && open.status !== "pending_confirmation")) {
            return {
                subscribed: false,
                alreadySubscribed: false,
                detail: "WABA ainda não confirmada.",
            };
        }
        const result = await new meta_whatsapp_webhook_subscription_service_1.MetaWhatsappWebhookSubscriptionService().ensureSubscribed(open);
        return {
            subscribed: result.subscribed,
            alreadySubscribed: result.alreadySubscribed,
            detail: result.detail,
        };
    }
    async updatePortfolioFromAuth(auth, input) {
        const tenant = requireTenant(auth);
        const displayName = (0, meta_whatsapp_phone_profile_1.parseDisplayName)(input.displayName);
        const photo = (0, meta_whatsapp_phone_profile_1.parseProfilePhoto)({ photoBase64: input.photoBase64, photoMime: input.photoMime });
        if (!displayName && !photo) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        }
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        const businessId = String(open.metaBusinessId || "").trim();
        if (!businessId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_payload");
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-profile-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        (0, meta_whatsapp_portfolio_identity_store_1.writePortfolioIdentity)(tenant.tenantId, {
            name: displayName || undefined,
            photo: photo
                ? { ext: photo.mime.includes("png") ? "png" : "jpg", bytes: photo.bytes }
                : undefined,
        });
        const nameUpdated = Boolean(displayName);
        const photoUpdated = Boolean(photo);
        const warnings = [];
        if (displayName) {
            const renamed = await this.graph({
                token,
                method: "POST",
                path: businessId,
                body: { name: displayName },
            });
            if (!renamed.ok) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "name",
                    status: renamed.status,
                    graphCode: renamed.graphCode,
                });
                if (renamed.status === 401)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                warnings.push("A Meta não aceitou o nome neste token.");
            }
        }
        if (photo) {
            const business = await this.graph({
                token,
                method: "GET",
                path: businessId,
                query: { fields: "id,primary_page{id,name}" },
            });
            const page = business.ok && business.json && typeof business.json === "object"
                ? business.json.primary_page
                : undefined;
            let pageId = String(page?.id || "").trim();
            if (!pageId) {
                const pages = await this.graph({
                    token,
                    method: "GET",
                    path: `${businessId}/owned_pages`,
                    query: { fields: "id,name" },
                });
                pageId = (0, meta_whatsapp_portfolio_map_1.firstOwnedPageId)(pages.json) || "";
            }
            if (!pageId) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "no_page",
                });
                warnings.push("A Meta não grava a foto do Business sem uma Página.");
            }
            else {
                try {
                    await this.setPagePicture({
                        token,
                        pageId,
                        fileName: photo.fileName,
                        mime: photo.mime,
                        bytes: photo.bytes,
                    });
                }
                catch (error) {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-profile-failed", {
                        tenantId: tenant.tenantId,
                        reason: "photo",
                        target: pageId,
                        detail: String(error?.message || "").slice(0, 80),
                    });
                    warnings.push("A Meta não aplicou a foto na Página.");
                }
            }
        }
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-profile-updated", {
            tenantId: tenant.tenantId,
            nameUpdated,
            photoUpdated,
            metaWarning: Boolean(warnings.length),
        });
        const listed = await this.listPortfolioAssets(auth);
        const warning = warnings.join(" ").trim();
        return { ...listed, nameUpdated, photoUpdated, ...(warning ? { warning } : {}) };
    }
    async readPortfolioPhotoFromAuth(auth) {
        const tenant = requireTenant(auth);
        return (0, meta_whatsapp_portfolio_identity_store_1.readPortfolioPhoto)(tenant.tenantId);
    }
}
exports.MetaWhatsappConnectionService = MetaWhatsappConnectionService;
