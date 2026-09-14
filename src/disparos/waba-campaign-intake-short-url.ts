import type { WabaPublicBaseRequestHints } from "../lib/waba-public-base-url";
import { attachCampaignIdToShortLink } from "../shortener/waba-shortener.service";
import { extractSlugFromPublicShortUrl } from "../shortener/waba-shortener.repository";
import { MetaWhatsappError } from "../integrations/meta-whatsapp/meta-whatsapp-errors";
import { createMetaTemplateButtonShortUrl } from "../integrations/meta-whatsapp/meta-whatsapp-template-ai-short-url";
import type { WabaDispatchesApiKind } from "./waba-dispatches-api-kind";

export type CampaignIntakeTrackedShortUrl = {
  shortUrl: string;
  shortSlug: string;
};

export type CampaignIntakeShortUrlFields = {
  responseLink?: string | null;
  responseShortUrl?: string | null;
};

export function shouldCreateIntakeTrackedShortUrl(apiKind: WabaDispatchesApiKind): boolean {
  return apiKind === "oficial";
}

export function resolveCampaignCardResponseLink(intake: CampaignIntakeShortUrlFields): string {
  return String(intake.responseShortUrl || intake.responseLink || "").trim();
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
