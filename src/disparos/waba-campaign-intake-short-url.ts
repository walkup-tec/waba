import type { WabaPublicBaseRequestHints } from "../lib/waba-public-base-url";
import { attachCampaignIdToShortLink, destinationUrlForShortRedirect } from "../shortener/waba-shortener.service";
import {
  extractSlugFromPublicShortUrl,
  findShortLinkByCampaignId,
  findShortLinkBySlug,
  getShortLinkClicksByCampaignId,
} from "../shortener/waba-shortener.repository";
import { MetaWhatsappError } from "../integrations/meta-whatsapp/meta-whatsapp-errors";
import { createMetaTemplateButtonShortUrl } from "../integrations/meta-whatsapp/meta-whatsapp-template-ai-short-url";
import type { WabaDispatchesApiKind } from "./waba-dispatches-api-kind";

export type CampaignIntakeTrackedShortUrl = {
  shortUrl: string;
  shortSlug: string;
};

export type CampaignIntakeShortUrlFields = {
  responseLink?: string | null;
  responseLinkOriginal?: string | null;
  responseShortUrl?: string | null;
  responseShortSlug?: string | null;
};

export function shouldCreateIntakeTrackedShortUrl(apiKind: WabaDispatchesApiKind): boolean {
  return apiKind === "oficial";
}

export function resolveCampaignCardResponseLink(intake: CampaignIntakeShortUrlFields): string {
  return String(intake.responseShortUrl || intake.responseLink || "").trim();
}

export function isWabaShortAliasUrl(raw: string): boolean {
  const value = String(raw || "").trim();
  if (!value) return false;
  try {
    return /\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(new URL(value).pathname);
  } catch {
    return /\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(value);
  }
}

export function stripDisparosTrackingNonce(raw: string): string {
  return destinationUrlForShortRedirect(raw);
}

export function normalizeClientOriginalResponseLink(raw: string): string {
  const stripped = stripDisparosTrackingNonce(raw);
  if (!stripped || isWabaShortAliasUrl(stripped)) return "";
  return stripped.slice(0, 2000);
}

export function persistClientOriginalResponseLink(
  existing: string | null | undefined,
  candidate: string | null | undefined,
): string {
  const kept = normalizeClientOriginalResponseLink(String(existing || ""));
  if (kept) return kept;
  return normalizeClientOriginalResponseLink(String(candidate || ""));
}

export function resolveStoredClientOriginalResponseLink(intake: CampaignIntakeShortUrlFields): string {
  return persistClientOriginalResponseLink(intake.responseLinkOriginal, intake.responseLink);
}

export async function lookupClientOriginalResponseLink(
  intake: CampaignIntakeShortUrlFields & { id?: string | null },
): Promise<string> {
  const stored = resolveStoredClientOriginalResponseLink(intake);
  if (stored) return stored;
  const slug =
    String(intake.responseShortSlug || "").trim() ||
    extractSlugFromPublicShortUrl(String(intake.responseShortUrl || "")) ||
    "";
  if (slug) {
    const bySlug = await findShortLinkBySlug(slug);
    const fromSlug = normalizeClientOriginalResponseLink(bySlug?.longUrl || "");
    if (fromSlug) return fromSlug;
  }
  const byCampaign = await findShortLinkByCampaignId(String(intake.id || ""));
  return normalizeClientOriginalResponseLink(byCampaign?.longUrl || "");
}

export function resolveOperacionalManualReportShowClicks(input: {
  hideClicks?: boolean;
  forceShowClicks?: boolean;
}): boolean {
  return Boolean(input.forceShowClicks) || !input.hideClicks;
}

export function resolveOperacionalManualReportClicks(input: {
  overrideClicks?: number | null;
  trackedClicks?: number | null;
}): number {
  if (input.overrideClicks != null) {
    return Math.max(0, Math.round(Number(input.overrideClicks) || 0));
  }
  return Math.max(0, Math.round(Number(input.trackedClicks || 0)));
}

export async function resolveIntakeTrackedShortUrlClicks(intake: {
  id?: string | null;
  responseShortSlug?: string | null;
  responseShortUrl?: string | null;
}): Promise<number> {
  const slug =
    String(intake.responseShortSlug || "").trim() ||
    extractSlugFromPublicShortUrl(String(intake.responseShortUrl || "")) ||
    "";
  if (slug) {
    const record = await findShortLinkBySlug(slug);
    if (record) return Math.max(0, Number(record.clicks || 0));
  }
  return getShortLinkClicksByCampaignId(String(intake.id || ""));
}

export type CreateCampaignIntakeTrackedShortUrlDeps = {
  createShortUrl?: typeof createMetaTemplateButtonShortUrl;
  attachCampaign?: typeof attachCampaignIdToShortLink;
  extractSlug?: typeof extractSlugFromPublicShortUrl;
};

export async function createCampaignIntakeTrackedShortUrl(
  input: {
    destinationUrl: string;
    campaignId: string;
    ownerEmail: string;
    publicBaseHints?: WabaPublicBaseRequestHints;
  },
  deps: CreateCampaignIntakeTrackedShortUrlDeps = {},
): Promise<CampaignIntakeTrackedShortUrl> {
  const campaignId = String(input.campaignId || "").trim();
  const destinationUrl = String(input.destinationUrl || "").trim();
  if (!campaignId || !destinationUrl) {
    throw Object.assign(new Error("Informe um link de resposta válido (http ou https)."), {
      statusCode: 400,
    });
  }
  const createShortUrl = deps.createShortUrl || createMetaTemplateButtonShortUrl;
  const attachCampaign = deps.attachCampaign || attachCampaignIdToShortLink;
  const extractSlug = deps.extractSlug || extractSlugFromPublicShortUrl;
  try {
    const shortUrl = await createShortUrl({
      destinationUrl,
      tenantId: String(input.ownerEmail || "").trim() || campaignId,
      publicBaseHints: input.publicBaseHints,
    });
    const shortSlug = extractSlug(shortUrl) || "";
    if (shortSlug) {
      await attachCampaign(shortSlug, campaignId);
    }
    return { shortUrl, shortSlug };
  } catch (error) {
    if (error instanceof MetaWhatsappError && error.code === "template_url_https") {
      throw Object.assign(new Error("Informe um link de resposta válido (http ou https)."), {
        statusCode: 400,
      });
    }
    throw Object.assign(
      new Error("Não foi possível gerar a URL de resposta da campanha. Tente novamente."),
      { statusCode: 502 },
    );
  }
}
