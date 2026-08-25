import { isWabaMasterEmail } from "./waba-auth.service";
import type { WabaRequestAuth } from "./waba-request-auth";

export type MetaOficialLabAccess =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Rotas /meta-oficial/* que mintam token ou fazem proxy Graph com token
 * enviado pelo browser. LAB é menu no mesmo app — autorização = MASTER only
 * (role de sessão `master` ou e-mail `WABA_ADMIN_EMAIL`).
 */
export function authorizeMetaOficialLabAccess(auth: WabaRequestAuth): MetaOficialLabAccess {
  if (!auth || auth.role === "guest" || !String(auth.email || "").trim()) {
    return { ok: false, status: 401, error: "Sessão expirada ou não autenticado." };
  }
  if (auth.role === "master" || isWabaMasterEmail(auth.email)) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    error: "Somente o usuário master pode usar as ferramentas Meta oficiais neste ambiente.",
  };
}

/** Alias estável: mint de token usa a mesma regra do LAB. */
export const authorizeMetaOficialTokenMint = authorizeMetaOficialLabAccess;

export const META_OFICIAL_LAB_GRAPH_PROXY_PATHS = [
  "POST /meta-oficial/embedded-signup/subscribe-webhooks",
  "POST /meta-oficial/ativos/phone-numbers/list",
  "POST /meta-oficial/ativos/phone-numbers/register",
  "POST /meta-oficial/ativos/subscribed-apps/list",
  "POST /meta-oficial/ativos/subscribed-apps/ensure",
  "POST /meta-oficial/templates/list",
  "POST /meta-oficial/templates/create-utility",
  "POST /meta-oficial/disparo/send-template",
] as const;

export const META_OFICIAL_LAB_TOKEN_MINT_PATHS = [
  "POST /meta-oficial/tokens/app-access",
  "POST /meta-oficial/tokens/system-user-access",
  "POST /waba-embedded-signup-exchange",
  "POST /meta/embedded-signup/exchange-code",
  "POST /meta-oficial/embedded-signup/exchange-code",
  "POST /api/meta/embedded-signup/exchange-code",
] as const;

/** Config pública (appId/configId) — sem token, sem Graph. Não exige master. */
export const META_OFICIAL_LAB_PUBLIC_CONFIG_PATH = "GET /meta-oficial/embedded-signup/config";
