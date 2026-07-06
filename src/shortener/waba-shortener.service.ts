import crypto from "crypto";
import type { WabaPublicBaseRequestHints } from "../lib/waba-public-base-url";
import {
  peekWabaShortPublicBaseUrl,
  rememberPublicBaseFromRequest,
  resolveWabaShortPublicBaseUrl,
} from "../lib/waba-public-base-url";
import {
  createShortLinkRecord,
  extractSlugFromPublicShortUrl,
  findShortLinkBySlug,
  getShortLinkClicksByUrl,
  incrementShortLinkClicks,
  normalizeSlug,
  randomSlug,
} from "./waba-shortener.repository";

function buildPublicShortUrl(slug: string, hints?: WabaPublicBaseRequestHints): string {
  rememberPublicBaseFromRequest(hints);
  const base = resolveWabaShortPublicBaseUrl(hints);
  return `${base}/s/${slug}`;
}

function deriveSlugFromLongUrl(longUrl: string): string {
  const nonceMatch =
    longUrl.match(/_n8n_link_nonce=([^&]+)/i) ||
    longUrl.match(/_n8n_test_nonce=([^&]+)/i);
  const rawNonce = String(nonceMatch?.[1] || "").trim();
  const clean = rawNonce.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (clean) return normalizeSlug(`n${clean.slice(-7)}`);
  return randomSlug(7);
}

export async function createWabaShortUrl(
  longUrl: string,
  options: { tenantId?: string; slug?: string; publicBaseHints?: WabaPublicBaseRequestHints } = {},
): Promise<string> {
  const safeLongUrl = String(longUrl || "").trim();
  if (!/^https?:\/\//i.test(safeLongUrl)) {
    throw new Error("URL original é obrigatória.");
  }

  let slug = normalizeSlug(options.slug || "");
  if (!slug) slug = deriveSlugFromLongUrl(safeLongUrl);

  const maxAttempts = 5;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateSlug = attempt === 0 ? slug : randomSlug(7);
    try {
      const record = await createShortLinkRecord({
        id: crypto.randomUUID(),
        slug: candidateSlug,
        longUrl: safeLongUrl,
        tenantId: options.tenantId,
      });
      return buildPublicShortUrl(record.slug, options.publicBaseHints);
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error?.message || "Falha ao criar slug"));
    }
  }

  throw lastError || new Error("Falha ao gerar link curto WABA.");
}

export async function resolveWabaShortRedirect(slug: string): Promise<string | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const record = await findShortLinkBySlug(normalized);
  if (!record?.longUrl) return null;
  await incrementShortLinkClicks(normalized);
  return record.longUrl;
}

export async function fetchWabaShortUrlClicks(shortUrl: string): Promise<number | null> {
  if (!extractSlugFromPublicShortUrl(shortUrl)) return null;
  return getShortLinkClicksByUrl(shortUrl);
}

export function isWabaManagedShortUrl(shortUrl: string): boolean {
  const slug = extractSlugFromPublicShortUrl(shortUrl);
  if (!slug) return false;
  const peek = peekWabaShortPublicBaseUrl();
  const base = String(peek.base || "").toLowerCase();
  if (!base) return String(shortUrl || "").toLowerCase().includes("/s/");
  try {
    const u = new URL(String(shortUrl || "").trim());
    const shortBase = new URL(base);
    return u.hostname === shortBase.hostname;
  } catch {
    return String(shortUrl || "").toLowerCase().includes("/s/");
  }
}

export { peekWabaShortPublicBaseUrl };
