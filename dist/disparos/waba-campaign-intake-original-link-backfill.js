"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyOriginalResponseLinkBackfill = applyOriginalResponseLinkBackfill;
exports.runOriginalResponseLinkBackfillOneshot = runOriginalResponseLinkBackfillOneshot;
const load_env_1 = require("../load-env");
const waba_campaign_intake_repository_1 = require("./waba-campaign-intake.repository");
const waba_campaign_intake_short_url_1 = require("./waba-campaign-intake-short-url");
async function applyOriginalResponseLinkBackfill(deps = {}) {
    const repository = deps.intakeRepository || new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository();
    const lookup = deps.lookup || waba_campaign_intake_short_url_1.lookupClientOriginalResponseLink;
    let applied = 0;
    for (const intake of repository.listAll()) {
        const existing = (0, waba_campaign_intake_short_url_1.persistClientOriginalResponseLink)(intake.responseLinkOriginal, "");
        if (existing)
            continue;
        const original = await lookup(intake);
        if (!original)
            continue;
        const updated = repository.updateById(intake.id, { responseLinkOriginal: original });
        if (updated)
            applied += 1;
    }
    return {
        ok: true,
        applied,
        message: applied > 0
            ? `Link original gravado em ${applied} campanha(s)`
            : "Nenhuma campanha pendente de link original",
    };
}
async function runOriginalResponseLinkBackfillOneshot(deps = {}) {
    const env = String(process.env.WABA_ENV || load_env_1.WABA_ENV || "").trim().toLowerCase();
    if (!deps.forceLocal && (env === "v01" || env === "v02" || env === "v03")) {
        return { ok: true, skipped: true, applied: 0, message: "oneshot ignorado em ambiente local" };
    }
    try {
        return await applyOriginalResponseLinkBackfill(deps);
    }
    catch (error) {
        return {
            ok: false,
            applied: 0,
            message: error instanceof Error ? error.message : "Falha ao gravar o link original das campanhas",
        };
    }
}
