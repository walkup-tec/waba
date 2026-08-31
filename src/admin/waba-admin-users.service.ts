import { WabaSystemUserService } from "../users/waba-system-user.service";

export class WabaAdminUsersService {
  constructor(private readonly systemUserService = new WabaSystemUserService()) {}

  listMenus() {
    return this.systemUserService.listMenuDefinitionsForAdmin();
  }

  listUsers() {
    return this.systemUserService.listPublicUsers();
  }

  createUser(input: Parameters<WabaSystemUserService["create"]>[0]) {
    return this.systemUserService.create(input);
  }

  updateUser(userId: string, input: Parameters<WabaSystemUserService["update"]>[1]) {
    return this.systemUserService.update(userId, input);
  }

  updateUserMenuPermissions(userId: string, menuPermissions: unknown) {
    return this.systemUserService.updateMenuPermissions(userId, menuPermissions);
  }

  deleteUser(userId: string, requesterEmail?: string) {
    this.systemUserService.delete(userId, requesterEmail);
  }
}
