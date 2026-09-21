import {
  extractSlugFromPublicShortUrl,
  peekShortLinkClicksSync,
} from "../../shortener/waba-shortener.repository";
import {
  resolveBroadcastReportedClicks,
  type MetaBroadcastCampaign,
} from "./meta-whatsapp-broadcast.store";

export type BroadcastButtonTrackPlan = {
  reuseExistingSlug: boolean;
  slug: string;
};

/** Botão estático da Meta: o WhatsApp abre esse /s/slug. Variável {{1}}: o disparo envia um slug novo. */
export function planBroadcastButtonTracking(button: {
  slug?: string | null;
  hasVariable?: boolean;
} | null | undefined): BroadcastButtonTrackPlan {
  const slug = String(button?.slug || "").trim().toLowerCase();
  if (slug && !button?.hasVariable) return { reuseExistingSlug: true, slug };
  return { reuseExistingSlug: false, slug: "" };
}

export function extraSlugsForIntake(intake?: {
  responseShortSlug?: string | null;
  responseShortUrl?: string | null;
} | null): string[] {
  return uniqueSlugs([
    intake?.responseShortSlug,
    extractSlugFromPublicShortUrl(String(intake?.responseShortUrl || "")),
  ]);
}

export function resolveReusedButtonShortUrl(input: {
  slug: string;
  buttonUrl?: string | null;
  publicBase?: string | null;
}): string {
  const slug = String(input.slug || "")
    .trim()
    .toLowerCase();
  const buttonUrl = String(input.buttonUrl || "").trim();
  if (buttonUrl && extractSlugFromPublicShortUrl(buttonUrl) === slug && /^https:\/\//i.test(buttonUrl)) {
    return buttonUrl;
  }
  const base = String(input.publicBase || "")
    .trim()
    .replace(/\/+$/, "");
  if (base) return `${base}/s/${slug}`;
  return `https://waba.draxsistemas.com.br/s/${slug}`;
}

function uniqueSlugs(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "");
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

export function resolveBoundCampaignClicks(input: {
  campaign?: Pick<MetaBroadcastCampaign, "clicks" | "clicksAtStart" | "trackedSlug" | "shortSlug" | "shortUrl"> | null;
  extraSlugs?: Array<string | null | undefined>;
}): number {
  const campaign = input.campaign || null;
  const stored = campaign
    ? resolveBroadcastReportedClicks(campaign, peekShortLinkClicksSync(String(campaign.trackedSlug || "")))
    : 0;
  const start = Math.max(0, Math.round(Number(campaign?.clicksAtStart || 0)));
  const slugs = uniqueSlugs([
    campaign?.trackedSlug,
    campaign?.shortSlug,
    ...(input.extraSlugs || []),
  ]);
  let clicks = stored;
  for (const slug of slugs) {
    const raw = peekShortLinkClicksSync(slug);
    if (raw == null) continue;
    clicks = Math.max(clicks, Math.max(0, raw - start));
  }
  return clicks;
}
