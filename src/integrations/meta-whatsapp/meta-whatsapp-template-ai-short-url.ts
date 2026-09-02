import type { WabaPublicBaseRequestHints } from "../../lib/waba-public-base-url";
import { createWabaShortUrl } from "../../shortener/waba-shortener.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { isMetaRestrictedTemplateButtonHost } from "./meta-whatsapp-template-validate";

export type MetaTemplateButtonShortUrlInput = {
  destinationUrl: string;
  tenantId: string;
  publicBaseHints?: WabaPublicBaseRequestHints;
};

/** Mesma normalização da URL de resposta da campanha (API Alternativa). */
export function normalizeMetaTemplateDestinationUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2000);
  return `https://${trimmed.replace(/^\/+/, "")}`.slice(0, 2000);
}

export function appendDisparosLinkNonce(destinationUrl: string, nonce: string): string {
  const base = normalizeMetaTemplateDestinationUrl(destinationUrl);
  try {
    const parsed = new URL(base);
    parsed.searchParams.set("_n8n_link_nonce", nonce);
    return parsed.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}_n8n_link_nonce=${encodeURIComponent(nonce)}`;
  }
}

export function assertMetaReadyButtonShortUrl(shortUrl: string): string {
  const url = String(shortUrl || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MetaWhatsappError("template_url_https");
  }
  if (parsed.protocol !== "https:") throw new MetaWhatsappError("template_url_https");
  if (isMetaRestrictedTemplateButtonHost(parsed.hostname)) {
    throw new MetaWhatsappError("template_url_restricted");
  }
  if (!/\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(parsed.pathname)) {
    throw new MetaWhatsappError("template_shorten_failed");
  }
  return url;
}

export async function createMetaTemplateButtonShortUrl(
  input: MetaTemplateButtonShortUrlInput,
): Promise<string> {
  const destination = normalizeMetaTemplateDestinationUrl(input.destinationUrl);
  if (!destination || !/^https?:\/\//i.test(destination)) {
    throw new MetaWhatsappError("template_url_https");
  }
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const longUrl = appendDisparosLinkNonce(destination, nonce);
  try {
    const shortUrl = await createWabaShortUrl(longUrl, {
      tenantId: String(input.tenantId || "").trim() || "meta-template",
      publicBaseHints: input.publicBaseHints,
    });
    return assertMetaReadyButtonShortUrl(shortUrl);
  } catch (error) {
    if (error instanceof MetaWhatsappError) throw error;
    throw new MetaWhatsappError("template_shorten_failed");
  }
}
