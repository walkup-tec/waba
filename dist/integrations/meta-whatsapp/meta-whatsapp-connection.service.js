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
function wabaIdFromPhoneJson(json) {
    const row = json && typeof json === "object" ? json : {};
    const nested = row.whatsapp_business_account;
    if (nested && typeof nested === "object") {
        return String(nested.id || "").trim();
    }
    return "";
}
class MetaWhatsappConnectionService {
    constructor(repository = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), oauth = { exchangeEmbeddedSignupCode: meta_whatsapp_oauth_1.exchangeEmbeddedSignupCode }, graph = (input) => (0, meta_whatsapp_graph_client_1.callMetaGraphJson)(input), decrypt = meta_token_crypto_1.decryptMetaToken) {
        this.repository = repository;
        this.oauth = oauth;
        this.graph = graph;
        this.decrypt = decrypt;
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
            return { portfolio: null, numbers: [] };
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
            const business = await this.graph({
                token,
                method: "GET",
                path: businessId,
                query: { fields: "id,name,primary_page{id,name}" },
            });
            if (business.ok) {
                portfolio = (0, meta_whatsapp_portfolio_map_1.mapMetaBusinessToPortfolio)(business.json, {
                    id: open.metaBusinessId,
                    wabaId: open.wabaId,
                });
            }
            else if (business.status === 401) {
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
        const wabaId = String(open.wabaId || "").trim();
        if (!wabaId) {
            return { portfolio: portfolio.id ? portfolio : null, numbers: [] };
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
            return { portfolio: portfolio.id ? portfolio : null, numbers: [] };
        }
        const numbers = (0, meta_whatsapp_portfolio_map_1.mapMetaPhoneListToPortfolioNumbers)(phones.json);
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("portfolio-listed", {
            tenantId: tenant.tenantId,
            hasBusiness: Boolean(portfolio.id),
            numbers: numbers.length,
        });
        return { portfolio: portfolio.id ? portfolio : null, numbers };
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
}
exports.MetaWhatsappConnectionService = MetaWhatsappConnectionService;
