import { WABA_ENV } from "../load-env";

export type WabaFeatureFlags = {
  /** Compra/ativação de números da fazenda (API não oficial via pool master). */
  alternativaNumbersPurchase: boolean;
  /**
   * Produto API Alternativa (créditos, wizard, menu Disparo EVO, bônus).
   * Desligado: novas operações recusam alternativa; campanhas antigas continuam no motor/split.
   */
  alternativaProduct: boolean;
  /** Card de portfólio + lista/ativação de números oficiais no Laboratório. */
  metaOfficialPortfolioLab: boolean;
  /**
   * Menu Dispositivos / Device Cloud (celulares virtuais no Aquecedor).
   * Desligado: menu, rotas e permissões somem; JSON e serviço ficam no disco para rollback.
   */
  deviceCloudProduct: boolean;
};

const parseTruthy = (raw: string): boolean | null => {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return null;
};

/** Produção para assinantes: desligado por padrão. Ligue só em V02/dev com env explícita. */
export function isAlternativaNumbersPurchaseEnabled(): boolean {
  const explicit = parseTruthy(String(process.env.WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED ?? ""));
  if (explicit !== null) return explicit;
  return false;
}

export const ALTERNATIVA_PRODUCT_UNAVAILABLE_MESSAGE =
  "A API Alternativa não está mais disponível. Utilize a API Oficial.";

/** Produto API Alternativa: desligado por padrão. Rollback: WABA_ALTERNATIVA_PRODUCT_ENABLED=1. */
export function isAlternativaProductEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = parseTruthy(String(env.WABA_ALTERNATIVA_PRODUCT_ENABLED ?? ""));
  if (explicit !== null) return explicit;
  return false;
}

export function assertAlternativaProductAllowsApiKind(apiKind: string): void {
  const kind = String(apiKind || "").trim().toLowerCase();
  if (kind === "alternativa" && !isAlternativaProductEnabled()) {
    throw new Error(ALTERNATIVA_PRODUCT_UNAVAILABLE_MESSAGE);
  }
}

/** Telas de portfólio/números oficiais no Laboratório. */
export function isMetaOfficialPortfolioLabEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = parseTruthy(String(env.WABA_META_OFFICIAL_PORTFOLIO_LAB ?? ""));
  if (explicit !== null) return explicit;
  return true;
}

export const DEVICE_CLOUD_PRODUCT_UNAVAILABLE_MESSAGE =
  "O menu Dispositivos não está mais disponível.";

/** Device Cloud / Dispositivos: desligado por padrão. Rollback: WABA_DEVICE_CLOUD_PRODUCT_ENABLED=1. */
export function isDeviceCloudProductEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = parseTruthy(String(env.WABA_DEVICE_CLOUD_PRODUCT_ENABLED ?? ""));
  if (explicit !== null) return explicit;
  return false;
}

export function getWabaFeatureFlags(): WabaFeatureFlags {
  return {
    alternativaNumbersPurchase: isAlternativaNumbersPurchaseEnabled(),
    alternativaProduct: isAlternativaProductEnabled(),
    metaOfficialPortfolioLab: isMetaOfficialPortfolioLabEnabled(),
    deviceCloudProduct: isDeviceCloudProductEnabled(),
  };
}

export function getWabaFeatureFlagsForClient(): WabaFeatureFlags {
  return getWabaFeatureFlags();
}

/** Diagnóstico em logs de boot (sem segredos). */
export function describeWabaFeatureFlagsForOps(): Record<string, boolean | string> {
  return {
    ...getWabaFeatureFlags(),
    wabaEnv: WABA_ENV || "default",
  };
}
