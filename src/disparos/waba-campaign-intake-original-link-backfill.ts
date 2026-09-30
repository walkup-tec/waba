import { WABA_ENV } from "../load-env";
import { WabaCampaignIntakeRepository } from "./waba-campaign-intake.repository";
import {
  lookupClientOriginalResponseLink,
  persistClientOriginalResponseLink,
} from "./waba-campaign-intake-short-url";

export type OriginalResponseLinkBackfillResult = {
  ok: boolean;
  skipped?: boolean;
  applied: number;
  message: string;
};

export type OriginalResponseLinkBackfillDeps = {
  forceLocal?: boolean;
  intakeRepository?: WabaCampaignIntakeRepository;
  lookup?: typeof lookupClientOriginalResponseLink;
};

export async function applyOriginalResponseLinkBackfill(
  deps: OriginalResponseLinkBackfillDeps = {},
): Promise<OriginalResponseLinkBackfillResult> {
  const repository = deps.intakeRepository || new WabaCampaignIntakeRepository();
  const lookup = deps.lookup || lookupClientOriginalResponseLink;
  let applied = 0;
  for (const intake of repository.listAll()) {
    const existing = persistClientOriginalResponseLink(intake.responseLinkOriginal, "");
    if (existing) continue;
    const original = await lookup(intake);
    if (!original) continue;
    const updated = repository.updateById(intake.id, { responseLinkOriginal: original });
    if (updated) applied += 1;
  }
  return {
    ok: true,
    applied,
    message:
      applied > 0
        ? `Link original gravado em ${applied} campanha(s)`
        : "Nenhuma campanha pendente de link original",
  };
}

export async function runOriginalResponseLinkBackfillOneshot(
  deps: OriginalResponseLinkBackfillDeps = {},
): Promise<OriginalResponseLinkBackfillResult> {
  const env = String(process.env.WABA_ENV || WABA_ENV || "").trim().toLowerCase();
  if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
    return { ok: true, skipped: true, applied: 0, message: "oneshot ignorado em ambiente local" };
  }
  try {
    return await applyOriginalResponseLinkBackfill(deps);
  } catch (error) {
    return {
      ok: false,
      applied: 0,
      message: error instanceof Error ? error.message : "Falha ao gravar o link original das campanhas",
    };
  }
}
