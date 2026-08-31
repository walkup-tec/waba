import {
  readMetaAppId,
  readMetaAppSecret,
  readMetaBusinessId,
  readMetaConfigId,
  readMetaGraphBase,
  readMetaGraphVersion,
  readMetaOauthRedirectUri,
} from "./meta-config";

export type MetaOauthExchangeResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number | null;
};

export async function exchangeEmbeddedSignupCode(input: {
  code: string;
  redirectUri?: string;
}): Promise<MetaOauthExchangeResult> {
  const code = String(input.code || "").trim();
  const appId = readMetaAppId();
  const appSecret = readMetaAppSecret();
  if (!code) throw new Error("Campo 'code' é obrigatório.");
  if (!appId || !appSecret) {
    throw new Error("Servidor sem META_APP_ID / META_APP_SECRET.");
  }

  const redirectFromEnv = readMetaOauthRedirectUri();
  const redirectFromInput = String(input.redirectUri || "").trim();
  const uniqueRedirects = Array.from(
    new Set([redirectFromEnv, redirectFromInput].filter(Boolean)),
  );
  const candidates: (string | undefined)[] = [...uniqueRedirects, undefined];

  const tryExchange = async (redirectUri: string | undefined) => {
    const url = new URL(`${readMetaGraphBase()}/${readMetaGraphVersion()}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("code", code);
    if (redirectUri) url.searchParams.set("redirect_uri", redirectUri);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { response, text, json };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let last: Awaited<ReturnType<typeof tryExchange>> | null = null;
  for (const redirectUri of candidates) {
    last = await tryExchange(redirectUri);
    if (last.response.ok) break;
    const msg = String(last.json?.error?.message || last.json?.error_description || last.text || "").toLowerCase();
    const retryWithoutRedirect =
      Boolean(redirectUri) &&
      (msg.includes("redirect_uri") || msg.includes("redirect uri") || msg.includes("matching"));
    if (retryWithoutRedirect) {
      last = await tryExchange(undefined);
      if (last.response.ok) break;
    }
  }

  if (!last) throw new Error("Falha interna ao consultar a Meta.");
  if (!last.response.ok) {
    const detail = String(last.json?.error?.message || last.json?.error_description || last.text || "").slice(0, 200);
    const error = new Error("Falha ao trocar código por token na Meta.") as Error & { status?: number; detail?: string };
    error.status = last.response.status >= 400 && last.response.status < 500 ? last.response.status : 424;
    error.detail = detail || undefined;
    throw error;
  }

  const accessToken = String(last.json?.access_token || "").trim();
  if (!accessToken) throw new Error("Resposta da Meta sem access_token.");
  const expiresInRaw = Number(last.json?.expires_in);
  return {
    accessToken,
    tokenType: String(last.json?.token_type || "bearer"),
    expiresIn: Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null,
  };
}

export function metaOauthExpiresAt(expiresIn: number | null): string | null {
  if (!expiresIn) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export { readMetaBusinessId, readMetaConfigId };
