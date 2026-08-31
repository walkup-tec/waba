"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminUsersService = void 0;
const waba_system_user_service_1 = require("../users/waba-system-user.service");
class WabaAdminUsersService {
    constructor(systemUserService = new waba_system_user_service_1.WabaSystemUserService()) {
        this.systemUserService = systemUserService;
    }
    listMenus() {
        return this.systemUserService.listMenuDefinitionsForAdmin();
    }
    listUsers() {
        return this.systemUserService.listPublicUsers();
    }
    createUser(input) {
        return this.systemUserService.create(input);
    }
    updateUser(userId, input) {
        return this.systemUserService.update(userId, input);
    }
    updateUserMenuPermissions(userId, menuPermissions) {
        return this.systemUserService.updateMenuPermissions(userId, menuPermissions);
    }
    deleteUser(userId, requesterEmail) {
        this.systemUserService.delete(userId, requesterEmail);
    }
}
exports.WabaAdminUsersService = WabaAdminUsersService;
