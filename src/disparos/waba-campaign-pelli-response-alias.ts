import crypto from "crypto";
import { WABA_ENV } from "../load-env";
import { WabaCampaignIntakeRepository, type WabaCampaignIntake } from "./waba-campaign-intake.repository";
import { isPelliAgendaPessoalCampaignName } from "./waba-campaign-pelli-reopen-aifocus";
import {
  createShortLinkRecord,
  findShortLinkBySlug,
  updateShortLinkLongUrl,
  type WabaShortLinkRecord,
} from "../shortener/waba-shortener.repository";
import { destinationUrlForShortRedirect } from "../shortener/waba-shortener.service";

export const PELLI_RESPONSE_SHORT_SLUG = "n6589823";
export const PELLI_ORIGINAL_RESPONSE_LINK = "https://chat.whatsapp.com/GhcEBOG2gbYBqSLrL5Hl3r";
export const PELLI_RESPONSE_SHORT_URL = "https://waba.draxsistemas.com.br/s/n6589823";

export type PelliResponseAliasResult = {
  ok: boolean;
  skipped?: boolean;
  applied?: boolean;
  campaignId?: string;
  shortSlug?: string;
  message: string;
};

export type PelliResponseAliasDeps = {
  forceLocal?: boolean;
  intakeRepository?: WabaCampaignIntakeRepository;
  findBySlug?: typeof findShortLinkBySlug;
  updateLongUrl?: typeof updateShortLinkLongUrl;
  createRecord?: typeof createShortLinkRecord;
  now?: () => string;
};

function findPelliIntake(repository: WabaCampaignIntakeRepository): WabaCampaignIntake | null {
  const named = repository.listAll().filter((row) => isPelliAgendaPessoalCampaignName(row.campaignName));
  if (!named.length) return null;
  named.sort(
    (a, b) =>
      Date.parse(String(b.updatedAt || b.createdAt || "")) -
      Date.parse(String(a.updatedAt || a.createdAt || "")),
  );
  return named[0] || null;
}

function aliasAlreadyPointsToOriginal(record: WabaShortLinkRecord | null): boolean {
  if (!record) return false;
  return destinationUrlForShortRedirect(record.longUrl) === PELLI_ORIGINAL_RESPONSE_LINK;
}

function intakeAlreadyWired(intake: WabaCampaignIntake): boolean {
  return (
    String(intake.responseLinkOriginal || "").trim() === PELLI_ORIGINAL_RESPONSE_LINK &&
    String(intake.responseShortSlug || "").trim() === PELLI_RESPONSE_SHORT_SLUG &&
    String(intake.responseShortUrl || "").trim() === PELLI_RESPONSE_SHORT_URL
  );
}

export async function applyPelliResponseAlias(
  deps: PelliResponseAliasDeps = {},
): Promise<PelliResponseAliasResult> {
  const repository = deps.intakeRepository || new WabaCampaignIntakeRepository();
  const findBySlug = deps.findBySlug || findShortLinkBySlug;
  const updateLongUrl = deps.updateLongUrl || updateShortLinkLongUrl;
  const createRecord = deps.createRecord || createShortLinkRecord;
  const intake = findPelliIntake(repository);
  if (!intake) {
    return { ok: true, skipped: true, message: "Campanha Pelli não encontrada" };
  }

  const existing = await findBySlug(PELLI_RESPONSE_SHORT_SLUG);
  const intakeReady = intakeAlreadyWired(intake);
  const aliasReady = aliasAlreadyPointsToOriginal(existing);
  if (intakeReady && aliasReady) {
    return {
      ok: true,
      skipped: true,
      campaignId: intake.id,
      shortSlug: PELLI_RESPONSE_SHORT_SLUG,
      message: "Alias da Pelli já apontava para o grupo do WhatsApp",
    };
  }

  if (existing) {
    const updated = await updateLongUrl(PELLI_RESPONSE_SHORT_SLUG, PELLI_ORIGINAL_RESPONSE_LINK, {
      campaignId: intake.id,
      intakeCampaignId: intake.id,
    });
    if (!updated) {
      return { ok: false, campaignId: intake.id, message: "Não foi possível atualizar o alias n6589823" };
    }
  } else {
    await createRecord({
      id: crypto.randomUUID(),
      slug: PELLI_RESPONSE_SHORT_SLUG,
      longUrl: PELLI_ORIGINAL_RESPONSE_LINK,
      tenantId: String(intake.ownerEmail || "").trim() || "pelli",
      campaignId: intake.id,
      intakeCampaignId: intake.id,
    });
  }

  const now = deps.now ? deps.now() : new Date().toISOString();
  const saved = repository.updateById(intake.id, {
    responseLinkOriginal: PELLI_ORIGINAL_RESPONSE_LINK,
    responseShortSlug: PELLI_RESPONSE_SHORT_SLUG,
    responseShortUrl: PELLI_RESPONSE_SHORT_URL,
    updatedAt: now,
  });
  if (!saved) {
    return { ok: false, campaignId: intake.id, message: "Alias atualizado, mas a campanha Pelli não gravou" };
  }

  return {
    ok: true,
    applied: true,
    campaignId: intake.id,
    shortSlug: PELLI_RESPONSE_SHORT_SLUG,
    message: "Alias da Pelli agora abre o grupo do WhatsApp",
  };
}

export async function runPelliResponseAliasOneshot(
  deps: PelliResponseAliasDeps = {},
): Promise<PelliResponseAliasResult> {
  const env = String(process.env.WABA_ENV || WABA_ENV || "").trim().toLowerCase();
  if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return { ok: true, skipped: true, message: "oneshot ignorado em ambiente local" };
  }
  try {
    return await applyPelliResponseAlias(deps);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Falha ao apontar o alias da Pelli",
    };
  }
}
