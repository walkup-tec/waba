import type { WabaSystemUser, WabaSystemUserRole } from "../users/waba-system-user.repository";
import {
  listWabaMenuDefinitions,
  listWabaMenuIds,
  WABA_SUBSCRIBER_DISPAROS_MENU_IDS,
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

/** Resolve permissões efetivas; chaves ausentes = desabilitado. */
export const resolveEffectiveMenuPermissions = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions">,
): MenuPermissionsMap => {
  if (user.role === "master") {
    return buildAllMenusEnabled();
  }

  const allIds = listWabaMenuIds();
  const stored = user.menuPermissions;
  const result: MenuPermissionsMap = {};

  for (const id of allIds) {
    result[id] = stored?.[id] === true;
  }

  return result;
};

/** Migra usuário legado (sem menuPermissions): concede todos os menus atuais uma vez. */
export const buildLegacyMigrationPermissions = (): MenuPermissionsMap => buildAllMenusEnabled();

/** Padrão operacional: Aquecedor + Disparos (Dashboard, Créditos, API Alternativa, API Oficial). */
export const buildDefaultOperacionalMenuPermissions = (): MenuPermissionsMap => {
  const result = buildNoMenusEnabled();
  const defaults = new Set<string>([
    "dashboard",
    "instancias",
    "aquecedor",
    ...WABA_SUBSCRIBER_DISPAROS_MENU_IDS,
  ]);
  for (const id of listWabaMenuIds()) {
    result[id] = defaults.has(id);
  }
  return result;
};

export const listAllowedMenuIds = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions">,
): string[] => {
  const effective = resolveEffectiveMenuPermissions(user);
  return Object.entries(effective)
    .filter(([, allowed]) => allowed)
    .map(([id]) => id);
};

export const isMenuAllowedForUser = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions">,
  menuId: string,
): boolean => {
  if (user.role === "master") return true;
  return resolveEffectiveMenuPermissions(user)[menuId] === true;
};

export const isTabAllowedForUser = (
  user: Pick<WabaSystemUser, "role" | "menuPermissions">,
  tab: string,
): boolean => {
  if (user.role === "master") return true;
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
