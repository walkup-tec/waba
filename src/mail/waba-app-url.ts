import { BASE_PATH } from "../base-path";

export const resolveWabaAppLoginUrl = (): string => {
  const fromEnv = String(process.env.WABA_APP_LOGIN_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const port = String(process.env.PORT || 3012).trim();
  const base = BASE_PATH || "";
  return `http://localhost:${port}${base}`;
};

export const buildCampaignReportDeepLink = (campaignId: string): string => {
  const id = String(campaignId || "").trim();
  const base = resolveWabaAppLoginUrl().replace(/\/$/, "");
  const url = new URL(`${base}/`);
  url.searchParams.set("campanhaRelatorio", id);
  return url.toString();
};

export const buildCampaignErrorDeepLink = (_campaignId?: string): string => buildCampaignListDeepLink();

export const buildCampaignListDeepLink = (): string => {
  const base = resolveWabaAppLoginUrl().replace(/\/$/, "");
  const url = new URL(`${base}/`);
  url.searchParams.set("aba", "disparos");
  return url.toString();
};

/** Deep link para operacional abrir detalhes da campanha no Admin · Campanhas. */
export const buildOperacionalAdminCampaignDeepLink = (campaignId: string): string => {
  const id = String(campaignId || "").trim();
  const base = resolveWabaAppLoginUrl().replace(/\/$/, "");
  const url = new URL(`${base}/`);
  url.searchParams.set("operacionalCampanha", id);
  return url.toString();
};
