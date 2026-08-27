/**
 * Laboratório (Meta Tech Provider) no painel de gestão.
 * Em produção só a conta Mozart vê a seção e os menus.
 * No localhost V02 as telas novas ficam visíveis para validação.
 */
export const WABA_LABORATORIO_OWNER_EMAIL = "mozart.pmo@gmail.com";

export function isWabaLaboratorioOwnerEmail(email: string): boolean {
  return String(email || "").trim().toLowerCase() === WABA_LABORATORIO_OWNER_EMAIL;
}

/** Mesma regra de `resolveUiProfile` em index.ts: default = production, exceto v01/full/baseline. */
export function isWabaUiProductionProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = String(env.WABA_UI_PROFILE || "").trim().toLowerCase();
  if (explicit === "production") return true;
  if (explicit === "full" || explicit === "baseline") return false;
  return String(env.WABA_ENV || "").trim().toLowerCase() !== "v01";
}

function isLocalV02Lab(env: NodeJS.ProcessEnv): boolean {
  if (String(env.WABA_ENV || "").trim().toLowerCase() !== "v02") return false;
  return String(env.RUNTIME_MODE || "").trim().toLowerCase() !== "production";
}

export function canAccessWabaLaboratorioMenus(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isLocalV02Lab(env)) return true;
  if (!isWabaUiProductionProfile(env)) return true;
  return isWabaLaboratorioOwnerEmail(email);
}
