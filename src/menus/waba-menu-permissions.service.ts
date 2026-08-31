import type { WabaSystemUser, WabaSystemUserRole } from "../users/waba-system-user.repository";
import { canAccessWabaLaboratorioMenus } from "./waba-laboratorio-access";
import {
  listWabaMenuDefinitions,
  listWabaMenuIds,
  WABA_SUBSCRIBER_DISPAROS_MENU_IDS,
  WABA_TECH_PROVIDER_MENU_IDS,
} from "./waba-menu-registry";

export type MenuPermissionsMap = Record<string, boolean>;

const normalizePermissionsInput = (
  input: unknown,
  allowedIds: Set<string>,
): MenuPermissionsMap => {
  const result: MenuPermissionsMap = {};
  if (!input || typeof input !== "object") return result;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!allowedIds.has(key)) continue;
    result[key] = value === true;
  }
  return result;
};

export const buildAllMenusEnabled = (): MenuPermissionsMap => {
  const result: MenuPermissionsMap = {};
  for (const id of listWabaMenuIds()) {
    result[id] = true;
  }
  return result;
};

export const buildNoMenusEnabled = (): MenuPermissionsMap => {
  const result: MenuPermissionsMap = {};
  for (const id of listWabaMenuIds()) {
    result[id] = false;
  }
  return result;
};

function applyLaboratorioMenuPolicy(
  user: Pick<WabaSystemUser, "email">,
  permissions: MenuPermissionsMap,
): MenuPermissionsMap {
  if (canAccessWabaLaboratorioMenus(user.email)) return permissions;
  const result = { ...permissions };
  for (const id of WABA_TECH_PROVIDER_MENU_IDS) {
    result[id] = false;
  }
  return result;
}

/** Resolve permissões efetivas; chaves ausentes = desabilitado. */
export const resolveEffectiveMenuPermissions = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions" | "email">,
): MenuPermissionsMap => {
  if (user.role === "master") {
    return applyLaboratorioMenuPolicy(user, buildAllMenusEnabled());
  }

  const allIds = listWabaMenuIds();
  const stored = user.menuPermissions;
  const result: MenuPermissionsMap = {};

  for (const id of allIds) {
    result[id] = stored?.[id] === true;
  }

  return applyLaboratorioMenuPolicy(user, result);
};

/** Migra usuário legado (sem menuPermissions): concede todos os menus atuais uma vez. */
export const buildLegacyMigrationPermissions = (): MenuPermissionsMap => buildAllMenusEnabled();

/** Padrão operacional: Aquecedor + Disparos + Laboratório (Meta Tech Provider). */
export const buildDefaultOperacionalMenuPermissions = (): MenuPermissionsMap => {
  const result = buildNoMenusEnabled();
  const defaults = new Set<string>([
    "dashboard",
    "instancias",
    "aquecedor",
    ...WABA_SUBSCRIBER_DISPAROS_MENU_IDS,
    ...WABA_TECH_PROVIDER_MENU_IDS,
  ]);
  for (const id of listWabaMenuIds()) {
    result[id] = defaults.has(id);
  }
  return result;
};

export const listAllowedMenuIds = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions" | "email">,
): string[] => {
  const effective = resolveEffectiveMenuPermissions(user);
  return Object.entries(effective)
    .filter(([, allowed]) => allowed)
    .map(([id]) => id);
};

export const isMenuAllowedForUser = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions" | "email">,
  menuId: string,
): boolean => {
  return resolveEffectiveMenuPermissions(user)[menuId] === true;
};

export const isTabAllowedForUser = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions" | "email">,
  tab: string,
): boolean => {
  const menus = listWabaMenuDefinitions().filter((item) => item.tab === tab);
  if (!menus.length) return true;
  const effective = resolveEffectiveMenuPermissions(user);
  return menus.some((menu) => effective[menu.id] === true);
};

export const parseMenuPermissionsForCreate = (
  role: WabaSystemUserRole,
  input: unknown,
): MenuPermissionsMap => {
  if (role === "master") {
    return buildAllMenusEnabled();
  }

  const allowedIds = new Set(listWabaMenuIds());
  const parsed = normalizePermissionsInput(input, allowedIds);
  const hasAnySelected = [...allowedIds].some((id) => parsed[id] === true);
  if (!hasAnySelected && role === "operacional") {
    return buildDefaultOperacionalMenuPermissions();
  }
  const result = buildNoMenusEnabled();
  for (const id of allowedIds) {
    result[id] = parsed[id] === true;
  }
  return result;
};

export const parseMenuPermissionsForUpdate = (
  role: WabaSystemUserRole,
  input: unknown,
): MenuPermissionsMap => {
  if (role === "master") {
    return buildAllMenusEnabled();
  }
  return parseMenuPermissionsForCreate(role, input);
};

export const countEnabledMenus = (permissions: MenuPermissionsMap): number =>
  Object.values(permissions).filter(Boolean).length;
