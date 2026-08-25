const readEnv = (key: string): string => String(process.env[key] || "").trim();

/** Config ID do Embedded Signup. Novo nome oficial; fallback legado. */
export function readMetaConfigId(): string {
  return readEnv("META_CONFIG_ID") || readEnv("META_ES_CONFIG_ID");
}

export function readMetaAppId(): string {
  return readEnv("META_APP_ID");
}

export function readMetaAppSecret(): string {
  return readEnv("META_APP_SECRET");
}

export function readMetaBusinessId(): string {
  return readEnv("META_BUSINESS_ID");
}

export function readMetaGraphBase(): string {
  return (readEnv("META_GRAPH_BASE") || "https://graph.facebook.com").replace(/\/+$/, "");
}

export function readMetaGraphVersion(): string {
  return readEnv("META_GRAPH_VERSION") || "v22.0";
}

export function readMetaOauthRedirectUri(): string {
  return readEnv("META_OAUTH_REDIRECT_URI");
}

export function readMetaWebhookVerifyToken(): string {
  return readEnv("META_WEBHOOK_VERIFY_TOKEN");
}

export function isMetaTechProviderConfigured(): boolean {
  return Boolean(readMetaAppId() && readMetaAppSecret() && readMetaConfigId());
}

function clampPollMs(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(30000, Math.max(2000, Math.floor(n)));
}

export function readMetaInboxPollMs(): { listMs: number; threadMs: number } {
  return {
    listMs: clampPollMs(readEnv("META_INBOX_LIST_POLL_MS"), 8000),
    threadMs: clampPollMs(readEnv("META_INBOX_THREAD_POLL_MS"), 3000),
  };
}
