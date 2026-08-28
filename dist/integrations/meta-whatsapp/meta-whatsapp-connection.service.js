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
const meta_whatsapp_phone_profile_1 = require("./meta-whatsapp-phone-profile");
const meta_whatsapp_resumable_upload_1 = require("./meta-whatsapp-resumable-upload");
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
function withLocalPortfolioIdentity(tenantId, assets) {
    if (!assets.portfolio)
        return assets;
    return {
        ...assets,
        portfolio: (0, meta_whatsapp_portfolio_identity_store_1.applyLocalPortfolioIdentity)(tenantId, assets.portfolio),
    };
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
            graphVersion: (0, meta_config_1.readMetaGraphVersion)(),
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
                metaBusinessId: (0, meta_config_1.readMetaBusinessId)() || null,
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
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("no_pending_connection");
        }
        const wabaId = String(open.wabaId || input.wabaId || "").trim();
        const phoneNumberId = String(open.phoneNumberId || input.phoneNumberId || "").trim();
        const businessId = String(open.metaBusinessId || input.businessId || "").trim();
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
    async listPortfolioAssets(auth) {
        const tenant = requireTenant(auth);
        const open = await this.repository.findOpenByTenant(tenant.tenantId);
        if (!open) {
            return withLocalPortfolioIdentity(tenant.tenantId, { portfolio: null, numbers: [] });
        }
        const fallbackPortfolio = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)({ id: open.metaBusinessId, name: null, primary_page: null }, { id: open.metaBusinessId, wabaId: open.wabaId });
        let token = "";
        try {
            token = this.decrypt(open.accessTokenEncrypted);
        }
        catch {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "decrypt" });
            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
        }
        let portfolio = fallbackPortfolio;
        const businessId = String(open.metaBusinessId || "").trim();
        if (businessId) {
            const identity = { id: open.metaBusinessId, wabaId: open.wabaId };
            const business = await this.graph({
                token,
                method: "GET",
                path: businessId,
                query: {
                    fields: "id,name,profile_picture_uri,primary_page{id,name,picture}",
                },
            });
            if (business.ok) {
                portfolio = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(business.json, identity);
            }
            else if (business.status === 401) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "business" });
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            }
            else {
                const fallbackBusiness = await this.graph({
                    token,
                    method: "GET",
                    path: businessId,
                    query: { fields: "id,name,primary_page{id,name}" },
                });
                if (fallbackBusiness.ok) {
                    portfolio = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(fallbackBusiness.json, identity);
                }
                else if (fallbackBusiness.status === 401) {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-failed", { tenantId: tenant.tenantId, reason: "business" });
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                }
                else {
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-partial", {
                        tenantId: tenant.tenantId,
                        reason: "business",
                        status: business.status,
                    });
                }
            }
        }
        const wabaId = String(open.wabaId || "").trim();
        if (!wabaId) {
            return withLocalPortfolioIdentity(tenant.tenantId, {
                portfolio: portfolio.id ? portfolio : null,
                numbers: [],
            });
        }
        const phones = await this.graph({
            token,
            method: "GET",
            path: `${wabaId}/phone_numbers`,
            query: {
                fields: "id,display_phone_number,verified_name,quality_rating,status,code_verification_status",
            },
        });
        if (!phones.ok) {
            (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-list-failed", {
                tenantId: tenant.tenantId,
                reason: "phones",
                status: phones.status,
            });
            if (phones.status === 401)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
            return withLocalPortfolioIdentity(tenant.tenantId, {
                portfolio: portfolio.id ? portfolio : null,
                numbers: [],
            });
        }
        const numbers = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)(phones.json);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-listed", {
            tenantId: tenant.tenantId,
            hasBusiness: Boolean(portfolio.id),
            numbers: numbers.length,
        });
        return withLocalPortfolioIdentity(tenant.tenantId, {
            portfolio: portfolio.id ? portfolio : null,
            numbers,
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
        if (!phoneNumberId || (!displayName && !photo)) {
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
        const warnings = [];
        let photoUpdated = false;
        if (photo) {
            if (!connected) {
                (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                    tenantId: tenant.tenantId,
                    reason: "not_registered",
                });
                if (!displayName)
                    throw new meta_whatsapp_errors_1.MetaWhatsappError("phone_not_registered");
                warnings.push("A foto só muda depois que o número estiver Ativo (PIN de 6 dígitos).");
            }
            else {
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
                    const profile = await this.graph({
                        token,
                        method: "POST",
                        path: `${phoneNumberId}/whatsapp_business_profile`,
                        body: { messaging_product: "whatsapp", profile_picture_handle: handle },
                    });
                    if (!profile.ok) {
                        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                            tenantId: tenant.tenantId,
                            reason: "photo",
                            status: profile.status,
                            graphCode: profile.graphCode,
                        });
                        if (profile.status === 401)
                            throw new meta_whatsapp_errors_1.MetaWhatsappError("invalid_token");
                        warnings.push("A Meta recusou a foto deste número.");
                    }
                    else {
                        photoUpdated = true;
                    }
                }
                catch (error) {
                    if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError)
                        throw error;
                    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-failed", {
                        tenantId: tenant.tenantId,
                        reason: "upload",
                        detail: String(error?.message || "").slice(0, 80),
                    });
                    warnings.push("A Meta recusou o envio da foto.");
                }
            }
        }
        let namePending = false;
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
                warnings.push("A Meta recusou o novo nome de exibição.");
            }
            else {
                namePending = true;
            }
        }
        if (!photoUpdated && !namePending) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError(photo && !connected ? "phone_not_registered" : "profile_update_failed");
        }
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("phone-profile-updated", {
            tenantId: tenant.tenantId,
            namePending,
            photoUpdated,
        });
        const listed = await this.listPortfolioAssets(auth);
        const warning = warnings.join(" ").trim();
        return { ...listed, namePending, photoUpdated, ...(warning ? { warning } : {}) };
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
