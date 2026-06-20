"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countEnabledMenus = exports.parseMenuPermissionsForUpdate = exports.parseMenuPermissionsForCreate = exports.isTabAllowedForUser = exports.isMenuAllowedForUser = exports.listAllowedMenuIds = exports.buildLegacyMigrationPermissions = exports.resolveEffectiveMenuPermissions = exports.buildNoMenusEnabled = exports.buildAllMenusEnabled = void 0;
const waba_menu_registry_1 = require("./waba-menu-registry");
const normalizePermissionsInput = (input, allowedIds) => {
    const result = {};
    if (!input || typeof input !== "object")
        return result;
    for (const [key, value] of Object.entries(input)) {
        if (!allowedIds.has(key))
            continue;
        result[key] = value === true;
    }
    return result;
};
const buildAllMenusEnabled = () => {
    const result = {};
    for (const id of (0, waba_menu_registry_1.listWabaMenuIds)()) {
        result[id] = true;
    }
    return result;
};
exports.buildAllMenusEnabled = buildAllMenusEnabled;
const buildNoMenusEnabled = () => {
    const result = {};
    for (const id of (0, waba_menu_registry_1.listWabaMenuIds)()) {
        result[id] = false;
    }
    return result;
};
exports.buildNoMenusEnabled = buildNoMenusEnabled;
/** Resolve permissões efetivas; chaves ausentes = desabilitado. */
const resolveEffectiveMenuPermissions = (user) => {
    if (user.role === "master") {
        return (0, exports.buildAllMenusEnabled)();
    }
    const allIds = (0, waba_menu_registry_1.listWabaMenuIds)();
    const stored = user.menuPermissions;
    const result = {};
    for (const id of allIds) {
        result[id] = stored?.[id] === true;
    }
    return result;
};
exports.resolveEffectiveMenuPermissions = resolveEffectiveMenuPermissions;
/** Migra usuário legado (sem menuPermissions): concede todos os menus atuais uma vez. */
const buildLegacyMigrationPermissions = () => (0, exports.buildAllMenusEnabled)();
exports.buildLegacyMigrationPermissions = buildLegacyMigrationPermissions;
const listAllowedMenuIds = (user) => {
    const effective = (0, exports.resolveEffectiveMenuPermissions)(user);
    return Object.entries(effective)
        .filter(([, allowed]) => allowed)
        .map(([id]) => id);
};
exports.listAllowedMenuIds = listAllowedMenuIds;
const isMenuAllowedForUser = (user, menuId) => {
    if (user.role === "master")
        return true;
    return (0, exports.resolveEffectiveMenuPermissions)(user)[menuId] === true;
};
exports.isMenuAllowedForUser = isMenuAllowedForUser;
const isTabAllowedForUser = (user, tab) => {
    if (user.role === "master")
        return true;
    const menus = (0, waba_menu_registry_1.listWabaMenuDefinitions)().filter((item) => item.tab === tab);
    if (!menus.length)
        return true;
    const effective = (0, exports.resolveEffectiveMenuPermissions)(user);
    return menus.some((menu) => effective[menu.id] === true);
};
exports.isTabAllowedForUser = isTabAllowedForUser;
const parseMenuPermissionsForCreate = (role, input) => {
    if (role === "master") {
        return (0, exports.buildAllMenusEnabled)();
    }
    const allowedIds = new Set((0, waba_menu_registry_1.listWabaMenuIds)());
    const parsed = normalizePermissionsInput(input, allowedIds);
    const result = (0, exports.buildNoMenusEnabled)();
    for (const id of allowedIds) {
        result[id] = parsed[id] === true;
    }
    return result;
};
exports.parseMenuPermissionsForCreate = parseMenuPermissionsForCreate;
const parseMenuPermissionsForUpdate = (role, input) => {
    if (role === "master") {
        return (0, exports.buildAllMenusEnabled)();
    }
    return (0, exports.parseMenuPermissionsForCreate)(role, input);
};
exports.parseMenuPermissionsForUpdate = parseMenuPermissionsForUpdate;
const countEnabledMenus = (permissions) => Object.values(permissions).filter(Boolean).length;
exports.countEnabledMenus = countEnabledMenus;
