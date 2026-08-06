/**
 * Credenciais Proxy Brasil (IPv4 dedicado recomendado para WhatsApp/Evolution).
 *
 * Formatos aceitos no .env:
 * - Campos separados: PROXY_BRASIL_HOST/PORT/USERNAME/PASSWORD
 * - Compacto: PROXY_BRASIL_IPV4=host:port:user:pass
 * - Compacto IPv6: PROXY_BRASIL_IPV6=host:port:user:pass (se PROXY_BRASIL_SLOT=ipv6)
 */

export type ProxyBrasilResolved = {
  enabled: boolean;
  host: string;
  port: string;
  protocol: "http" | "https" | "socks4" | "socks5";
  username: string;
  password: string;
  apiKey: string | null;
  slot: "ipv4" | "ipv6";
  applyOnCreate: boolean;
  source: string;
};

function envFlag(raw: string | undefined, defaultOn: boolean): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return defaultOn;
  return !["0", "false", "off", "no"].includes(v);
}

function parseProtocol(raw: string | undefined): ProxyBrasilResolved["protocol"] {
  const v = String(raw || "http").trim().toLowerCase();
  if (v === "https" || v === "socks4" || v === "socks5" || v === "http") return v;
  return "http";
}

/** host:port:user:password (password pode conter ':') */
export function parseProxyBrasilCompact(raw: string): {
  host: string;
  port: string;
  username: string;
  password: string;
} | null {
  const s = String(raw || "").trim();
  if (!s || s.startsWith("#")) return null;
  const parts = s.split(":");
  if (parts.length < 4) return null;
  const host = String(parts[0] || "").trim();
  const port = String(parts[1] || "").trim();
  const username = String(parts[2] || "").trim();
  const password = parts.slice(3).join(":").trim();
  if (!host || !port || !username || !password) return null;
  if (!/^\d+$/.test(port)) return null;
  return { host, port, username, password };
}

export function loadProxyBrasilConfig(): ProxyBrasilResolved | null {
  const slotRaw = String(process.env.PROXY_BRASIL_SLOT || "ipv4").trim().toLowerCase();
  const slot: "ipv4" | "ipv6" = slotRaw === "ipv6" ? "ipv6" : "ipv4";
  const compactKey = slot === "ipv6" ? "PROXY_BRASIL_IPV6" : "PROXY_BRASIL_IPV4";
  const compact = parseProxyBrasilCompact(String(process.env[compactKey] || ""));

  const host = String(process.env.PROXY_BRASIL_HOST || compact?.host || "").trim();
  const port = String(process.env.PROXY_BRASIL_PORT || compact?.port || "").trim();
  const username = String(process.env.PROXY_BRASIL_USERNAME || compact?.username || "").trim();
  const password = String(process.env.PROXY_BRASIL_PASSWORD || compact?.password || "").trim();
  const protocol = parseProtocol(process.env.PROXY_BRASIL_PROTOCOL);
  const apiKey = String(process.env.PROXY_BRASIL_API_KEY || "").trim() || null;
  const enabled = envFlag(process.env.PROXY_BRASIL_ENABLED, Boolean(host && port && username && password));
  // Padrão OFF: proxy só na seleção de campanha Alternativa, nunca no QR/Aquecedor.
  const applyOnCreate = envFlag(process.env.PROXY_BRASIL_APPLY_ON_CREATE, false);

  if (!host || !port || !username || !password) return null;

  return {
    enabled,
    host,
    port,
    protocol,
    username,
    password,
    apiKey,
    slot,
    applyOnCreate,
    source: compact ? compactKey : "PROXY_BRASIL_HOST",
  };
}

export function proxyBrasilPublicSummary(cfg: ProxyBrasilResolved | null): Record<string, unknown> {
  if (!cfg) {
    return { configured: false, enabled: false };
  }
  return {
    configured: true,
    enabled: cfg.enabled,
    host: cfg.host,
    port: cfg.port,
    protocol: cfg.protocol,
    username: cfg.username,
    passwordSet: Boolean(cfg.password),
    apiKeySet: Boolean(cfg.apiKey),
    slot: cfg.slot,
    applyOnCreate: cfg.applyOnCreate,
    source: cfg.source,
  };
}
