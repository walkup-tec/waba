"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOperacionalAdminCampaignDeepLink = exports.buildCampaignListDeepLink = exports.buildCampaignErrorDeepLink = exports.buildCampaignReportDeepLink = exports.resolveWabaAppLoginUrl = void 0;
const base_path_1 = require("../base-path");
const resolveWabaAppLoginUrl = () => {
    const fromEnv = String(process.env.WABA_APP_LOGIN_URL ?? "")
        .trim()
        .replace(/\/$/, "");
    if (fromEnv)
        return fromEnv;
    const fromPublic = String(process.env.WABA_PUBLIC_BASE_URL ?? process.env.WABA_WEBHOOK_BASE_URL ?? "")
        .trim()
        .replace(/\/$/, "");
    if (fromPublic)
        return fromPublic;
    const port = String(process.env.PORT || 3012).trim();
    const base = base_path_1.BASE_PATH || "";
    return `http://localhost:${port}${base}`;
};
exports.resolveWabaAppLoginUrl = resolveWabaAppLoginUrl;
const buildCampaignReportDeepLink = (campaignId) => {
    const id = String(campaignId || "").trim();
    const base = (0, exports.resolveWabaAppLoginUrl)().replace(/\/$/, "");
    const url = new URL(`${base}/`);
    url.searchParams.set("campanhaRelatorio", id);
    return url.toString();
};
exports.buildCampaignReportDeepLink = buildCampaignReportDeepLink;
const buildCampaignErrorDeepLink = (_campaignId) => (0, exports.buildCampaignListDeepLink)();
exports.buildCampaignErrorDeepLink = buildCampaignErrorDeepLink;
const buildCampaignListDeepLink = () => {
    const base = (0, exports.resolveWabaAppLoginUrl)().replace(/\/$/, "");
    const url = new URL(`${base}/`);
    url.searchParams.set("aba", "disparos");
    return url.toString();
};
exports.buildCampaignListDeepLink = buildCampaignListDeepLink;
/** Deep link para operacional abrir detalhes da campanha no Admin · Campanhas. */
const buildOperacionalAdminCampaignDeepLink = (campaignId) => {
    const id = String(campaignId || "").trim();
    const base = (0, exports.resolveWabaAppLoginUrl)().replace(/\/$/, "");
    const url = new URL(`${base}/`);
    url.searchParams.set("operacionalCampanha", id);
    return url.toString();
};
exports.buildOperacionalAdminCampaignDeepLink = buildOperacionalAdminCampaignDeepLink;
