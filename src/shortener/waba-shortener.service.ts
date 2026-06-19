import crypto from "crypto";
import {
  createShortLinkRecord,
  extractSlugFromPublicShortUrl,
  findShortLinkBySlug,
  getShortLinkClicksByUrl,
  incrementShortLinkClicks,
  normalizeSlug,
  randomSlug,
} from "./waba-shortener.repository";

function resolveWabaShortPublicBase(): string {
  const explicit = String(
    process.env.WABA_SHORT_PUBLIC_BASE ||
      process.env.BASE_SHORT_DOMAIN ||
      process.env.WABA_SHORTENER_PUBLIC_BASE ||
      ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (explicit) return explicit;
  const port = String(process.env.PORT || "3000").trim();
  return `http://localhost:${port}`;
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

function buildPublicShortUrl(slug: string): string {
  const base = resolveWabaShortPublicBase();
  return `${base}/s/${slug}`;
}

export async function createWabaShortUrl(
  longUrl: string,
  options: { tenantId?: string; slug?: string } = {}
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
      return buildPublicShortUrl(record.slug);
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
  const base = resolveWabaShortPublicBase().toLowerCase();
  try {
    const u = new URL(String(shortUrl || "").trim());
    const shortBase = new URL(base);
    return u.hostname === shortBase.hostname;
  } catch {
    return String(shortUrl || "").toLowerCase().includes("/s/");
  }
}
