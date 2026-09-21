"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planBroadcastButtonTracking = planBroadcastButtonTracking;
exports.extraSlugsForIntake = extraSlugsForIntake;
exports.resolveReusedButtonShortUrl = resolveReusedButtonShortUrl;
exports.resolveBoundCampaignClicks = resolveBoundCampaignClicks;
const waba_shortener_repository_1 = require("../../shortener/waba-shortener.repository");
const meta_whatsapp_broadcast_store_1 = require("./meta-whatsapp-broadcast.store");
/** Botão estático da Meta: o WhatsApp abre esse /s/slug. Variável {{1}}: o disparo envia um slug novo. */
function planBroadcastButtonTracking(button) {
    const slug = String(button?.slug || "").trim().toLowerCase();
    if (slug && !button?.hasVariable)
        return { reuseExistingSlug: true, slug };
    return { reuseExistingSlug: false, slug: "" };
}
function extraSlugsForIntake(intake) {
    return uniqueSlugs([
        intake?.responseShortSlug,
        (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(String(intake?.responseShortUrl || "")),
    ]);
}
function resolveReusedButtonShortUrl(input) {
    const slug = String(input.slug || "")
        .trim()
        .toLowerCase();
    const buttonUrl = String(input.buttonUrl || "").trim();
    if (buttonUrl && (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(buttonUrl) === slug && /^https:\/\//i.test(buttonUrl)) {
        return buttonUrl;
    }
    const base = String(input.publicBase || "")
        .trim()
        .replace(/\/+$/, "");
    if (base)
        return `${base}/s/${slug}`;
    return `https://waba.draxsistemas.com.br/s/${slug}`;
}
function uniqueSlugs(values) {
    const out = [];
    for (const value of values) {
        const slug = String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, "");
        if (slug && !out.includes(slug))
            out.push(slug);
    }
    return out;
}
function resolveBoundCampaignClicks(input) {
    const campaign = input.campaign || null;
    const stored = campaign
        ? (0, meta_whatsapp_broadcast_store_1.resolveBroadcastReportedClicks)(campaign, (0, waba_shortener_repository_1.peekShortLinkClicksSync)(String(campaign.trackedSlug || "")))
        : 0;
    const start = Math.max(0, Math.round(Number(campaign?.clicksAtStart || 0)));
    const slugs = uniqueSlugs([
        campaign?.trackedSlug,
        campaign?.shortSlug,
        ...(input.extraSlugs || []),
    ]);
    let clicks = stored;
    for (const slug of slugs) {
        const raw = (0, waba_shortener_repository_1.peekShortLinkClicksSync)(slug);
        if (raw == null)
            continue;
        clicks = Math.max(clicks, Math.max(0, raw - start));
    }
    return clicks;
}
