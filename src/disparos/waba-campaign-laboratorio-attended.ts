import { canAccessWabaLaboratorioMenus } from "../menus/waba-laboratorio-access";
import { isMenuAllowedForUser } from "../menus/waba-menu-permissions.service";
import { WABA_TECH_PROVIDER_MENU_IDS } from "../menus/waba-menu-registry";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import type { WabaSystemUser } from "../users/waba-system-user.repository";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export type LaboratorioStaffLookup = {
  getByEmail(email: string): Pick<WabaSystemUser, "email" | "role" | "menuPermissions"> | null;
};

export type CampaignLaboratorioAttendee = {
  assignedOperacionalEmail?: string | null;
  startedByEmail?: string | null;
};

function defaultLookup(): LaboratorioStaffLookup {
  return new WabaSystemUserService();
}

/**
 * Quem pode usar o Laboratório (e portanto dispara Cloud / coleta Meta).
 * Operacional/suporte: menus marcados no cadastro.
 * Master: a mesma regra de tela (produção = só Mozart).
 */
export function staffEmailHasLaboratorioAccess(
  email: string,
  lookup: LaboratorioStaffLookup = defaultLookup(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const user = lookup.getByEmail(normalized);
  if (!user) {
    return canAccessWabaLaboratorioMenus(normalized, env);
  }
  if (user.role === "master") {
    return canAccessWabaLaboratorioMenus(user.email, env);
  }
  if (user.role !== "operacional" && user.role !== "suporte") return false;
  return WABA_TECH_PROVIDER_MENU_IDS.some((id) => isMenuAllowedForUser(user, id));
}

/**
 * Relatório automático + cliques valem só para campanhas **atendidas**
 * por alguém com acesso ao Laboratório — não pelo plano oficial/alternativa.
 */
export function campaignAttendedByLaboratorioStaff(
  intake: CampaignLaboratorioAttendee,
  lookup: LaboratorioStaffLookup = defaultLookup(),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const assigned = normalizeEmail(String(intake.assignedOperacionalEmail || ""));
  if (assigned) return staffEmailHasLaboratorioAccess(assigned, lookup, env);
  const started = normalizeEmail(String(intake.startedByEmail || ""));
  if (started) return staffEmailHasLaboratorioAccess(started, lookup, env);
  return false;
}
