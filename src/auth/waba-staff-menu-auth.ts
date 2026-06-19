import type { Request, Response } from "express";
import { isMenuAllowedForUser } from "../menus/waba-menu-permissions.service";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import { resolveWabaRequestAuth } from "./waba-request-auth";

const systemUserService = new WabaSystemUserService();

export const rejectUnlessStaffMenu = (req: Request, res: Response, menuId: string) => {
  const auth = resolveWabaRequestAuth(req);
  if (!auth.email || auth.role === "guest") {
    res.status(401).json({ error: "Faça login para continuar." });
    return null;
  }
  if (auth.role === "master") return auth;

  const user = systemUserService.getByEmail(auth.email);
  if (!user || !isMenuAllowedForUser(user, menuId)) {
    res.status(403).json({ error: "Você não tem permissão para acessar esta área." });
    return null;
  }

  return auth;
};
