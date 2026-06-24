import { WABA_ENV } from "../load-env";

export type WabaFeatureFlags = {
  /** Compra/ativação de números da fazenda (API não oficial via pool master). */
  alternativaNumbersPurchase: boolean;
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

export function getWabaFeatureFlags(): WabaFeatureFlags {
  return {
    alternativaNumbersPurchase: isAlternativaNumbersPurchaseEnabled(),
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
