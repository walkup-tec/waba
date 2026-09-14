import { WABA_ENV } from "../load-env";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "./waba-campaign-intake.repository";
import {
  createCampaignIntakeTrackedShortUrl,
  type CreateCampaignIntakeTrackedShortUrlDeps,
  type CampaignIntakeTrackedShortUrl,
} from "./waba-campaign-intake-short-url";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";

export const VITORIA_DA_CONQUISTA_SUBSCRIBER_ID = "bd3fdfc3-c7a4-4234-8def-e0726e818937";
export const VITORIA_DA_CONQUISTA_CAMPAIGN_NAME = "VITORIA DA CONQUISTA";

export type VitoriaShortUrlOneshotResult = {
  applied: boolean;
  reason: string;
  message: string;
  campaignId?: string;
  shortUrl?: string;
  count?: number;
};

const intakeRepository = new WabaCampaignIntakeRepository();
const subscriberRepository = new WabaSubscriberRepository();

export function normalizeIntakeCampaignName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isVitoriaDaConquistaCampaignName(campaignName: string): boolean {
  return (
    normalizeIntakeCampaignName(campaignName) ===
    normalizeIntakeCampaignName(VITORIA_DA_CONQUISTA_CAMPAIGN_NAME)
  );
}

export function shouldBackfillVitoriaDaConquistaShortUrl(input: {
  subscriberId?: string | null;
  campaignName?: string | null;
  responseLink?: string | null;
  responseShortUrl?: string | null;
  responseShortSlug?: string | null;
}): boolean {
  if (String(input.subscriberId || "").trim() !== VITORIA_DA_CONQUISTA_SUBSCRIBER_ID) {
    return false;
  }
  if (!isVitoriaDaConquistaCampaignName(String(input.campaignName || ""))) return false;
  if (!String(input.responseLink || "").trim()) return false;
  const existingUrl = String(input.responseShortUrl || "").trim();
  const existingSlug = String(input.responseShortSlug || "").trim();
  return !(existingUrl && existingSlug);
}

async function persistTrackedShortUrl(
  intake: WabaCampaignIntake,
  deps: CreateCampaignIntakeTrackedShortUrlDeps = {},
): Promise<CampaignIntakeTrackedShortUrl | null> {
  const destinationUrl = String(intake.responseLink || "").trim();
  if (!destinationUrl) return null;
  const existingUrl = String(intake.responseShortUrl || "").trim();
  const existingSlug = String(intake.responseShortSlug || "").trim();
  if (existingUrl && existingSlug) {
    return { shortUrl: existingUrl, shortSlug: existingSlug };
  }
  try {
    const created = await createCampaignIntakeTrackedShortUrl(
      {
        destinationUrl,
        campaignId: intake.id,
        ownerEmail: intake.ownerEmail,
      },
      deps,
    );
    const updated = intakeRepository.updateById(intake.id, {
      responseShortUrl: created.shortUrl,
      responseShortSlug: created.shortSlug,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) return null;
    return created;
  } catch (error) {
    console.error(
      `[campanhas] falha ao gerar URL curta de ${VITORIA_DA_CONQUISTA_CAMPAIGN_NAME}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function ensureVitoriaDaConquistaIntakeShortUrlByCampaignId(
  campaignId: string,
  deps: CreateCampaignIntakeTrackedShortUrlDeps = {},
): Promise<CampaignIntakeTrackedShortUrl | null> {
  const intake = intakeRepository.getById(String(campaignId || "").trim());
  if (!intake) return null;
  const subscriber = subscriberRepository.getByEmail(String(intake.ownerEmail || "").trim());
  if (
    !shouldBackfillVitoriaDaConquistaShortUrl({
      subscriberId: subscriber?.id,
      campaignName: intake.campaignName,
      responseLink: intake.responseLink,
      responseShortUrl: intake.responseShortUrl,
      responseShortSlug: intake.responseShortSlug,
    })
  ) {
    return null;
  }
  return persistTrackedShortUrl(intake, deps);
}

export async function runVitoriaDaConquistaShortUrlOneshot(
  deps: CreateCampaignIntakeTrackedShortUrlDeps & { forceLocal?: boolean } = {},
): Promise<VitoriaShortUrlOneshotResult> {
  const env = String(WABA_ENV || process.env.WABA_ENV || "").trim().toLowerCase();
  if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return {
      applied: false,
      reason: "local-env",
      message: "oneshot ignorado em ambiente local",
    };
  }

  const subscriber = subscriberRepository.getById(VITORIA_DA_CONQUISTA_SUBSCRIBER_ID);
  if (!subscriber) {
    return {
      applied: false,
      reason: "subscriber-not-found",
      message: `Assinante ${VITORIA_DA_CONQUISTA_SUBSCRIBER_ID} não encontrado`,
    };
  }

  const matches = intakeRepository
    .listByEmail(subscriber.email)
    .filter((item) => isVitoriaDaConquistaCampaignName(item.campaignName));
  if (!matches.length) {
    return {
      applied: false,
      reason: "campaign-not-found",
      message: `Campanha ${VITORIA_DA_CONQUISTA_CAMPAIGN_NAME} não encontrada`,
    };
  }

  const pending = matches.filter((item) =>
    shouldBackfillVitoriaDaConquistaShortUrl({
      subscriberId: subscriber.id,
      campaignName: item.campaignName,
      responseLink: item.responseLink,
      responseShortUrl: item.responseShortUrl,
      responseShortSlug: item.responseShortSlug,
    }),
  );
  if (!pending.length) {
    const first = matches[0];
    return {
      applied: false,
      reason: first.responseShortUrl ? "already-has-short-url" : "missing-destination",
      message: first.responseShortUrl
        ? `URL curta já existia (${first.responseShortUrl})`
        : "Campanha sem link de resposta para incorporar",
      campaignId: first.id,
      shortUrl: first.responseShortUrl,
    };
  }

  const created: CampaignIntakeTrackedShortUrl[] = [];
  for (const intake of pending) {
    const next = await persistTrackedShortUrl(intake, deps);
    if (next) created.push(next);
  }
  if (!created.length) {
    return {
      applied: false,
      reason: "create-failed",
      message: "Não foi possível gerar a URL curta da campanha",
      campaignId: pending[0]?.id,
    };
  }

  return {
    applied: true,
    reason: "created",
    message: `URL curta gerada para ${VITORIA_DA_CONQUISTA_CAMPAIGN_NAME} (${created[0].shortUrl})`,
    campaignId: pending[0]?.id,
    shortUrl: created[0].shortUrl,
    count: created.length,
  };
}
