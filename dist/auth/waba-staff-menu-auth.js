"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectUnlessStaffMenu = void 0;
const waba_menu_permissions_service_1 = require("../menus/waba-menu-permissions.service");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_request_auth_1 = require("./waba-request-auth");
const systemUserService = new waba_system_user_service_1.WabaSystemUserService();
const rejectUnlessStaffMenu = (req, res, menuId) => {
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    if (!auth.email || auth.role === "guest") {
        res.status(401).json({ error: "Faça login para continuar." });
        return null;
    }
    if (auth.role === "master")
        return auth;
    const user = systemUserService.getByEmail(auth.email);
    if (!user || !(0, waba_menu_permissions_service_1.isMenuAllowedForUser)(user, menuId)) {
        res.status(403).json({ error: "Você não tem permissão para acessar esta área." });
        return null;
    }
    return auth;
};
exports.rejectUnlessStaffMenu = rejectUnlessStaffMenu;
