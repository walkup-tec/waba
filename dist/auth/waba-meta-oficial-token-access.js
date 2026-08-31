"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_OFICIAL_LAB_PUBLIC_CONFIG_PATH = exports.META_OFICIAL_LAB_TOKEN_MINT_PATHS = exports.META_OFICIAL_LAB_GRAPH_PROXY_PATHS = exports.authorizeMetaOficialTokenMint = void 0;
exports.authorizeMetaOficialLabAccess = authorizeMetaOficialLabAccess;
const waba_auth_service_1 = require("./waba-auth.service");
/**
 * Rotas /meta-oficial/* que mintam token ou fazem proxy Graph com token
 * enviado pelo browser. LAB é menu no mesmo app — autorização = MASTER only
 * (role de sessão `master` ou e-mail `WABA_ADMIN_EMAIL`).
 */
function authorizeMetaOficialLabAccess(auth) {
    if (!auth || auth.role === "guest" || !String(auth.email || "").trim()) {
        return { ok: false, status: 401, error: "Sessão expirada ou não autenticado." };
    }
    if (auth.role === "master" || (0, waba_auth_service_1.isWabaMasterEmail)(auth.email)) {
        return { ok: true };
    }
    return {
        ok: false,
        status: 403,
        error: "Somente o usuário master pode usar as ferramentas Meta oficiais neste ambiente.",
    };
}
/** Alias estável: mint de token usa a mesma regra do LAB. */
exports.authorizeMetaOficialTokenMint = authorizeMetaOficialLabAccess;
exports.META_OFICIAL_LAB_GRAPH_PROXY_PATHS = [
    "POST /meta-oficial/embedded-signup/subscribe-webhooks",
    "POST /meta-oficial/ativos/phone-numbers/list",
    "POST /meta-oficial/ativos/phone-numbers/register",
    "POST /meta-oficial/ativos/subscribed-apps/list",
    "POST /meta-oficial/ativos/subscribed-apps/ensure",
    "POST /meta-oficial/templates/list",
    "POST /meta-oficial/templates/create-utility",
    "POST /meta-oficial/disparo/send-template",
];
exports.META_OFICIAL_LAB_TOKEN_MINT_PATHS = [
    "POST /meta-oficial/tokens/app-access",
    "POST /meta-oficial/tokens/system-user-access",
    "POST /waba-embedded-signup-exchange",
    "POST /meta/embedded-signup/exchange-code",
    "POST /meta-oficial/embedded-signup/exchange-code",
    "POST /api/meta/embedded-signup/exchange-code",
];
/** Config pública (appId/configId) — sem token, sem Graph. Não exige master. */
exports.META_OFICIAL_LAB_PUBLIC_CONFIG_PATH = "GET /meta-oficial/embedded-signup/config";
