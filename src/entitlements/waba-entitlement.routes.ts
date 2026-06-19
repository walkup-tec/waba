import type { Express, Request } from "express";
import { resolveSessionRole, readWabaSessionCookie, verifyWabaSessionToken } from "../auth/waba-auth.service";
import { WabaEntitlementService } from "./waba-entitlement.service";

const entitlementService = new WabaEntitlementService();

const resolveRequestAuth = (req: Request) => {
  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) return { email: "", role: "guest" as const };
  return {
    email: session.email,
    role: resolveSessionRole(session),
  };
};

export const registerWabaEntitlementRoutes = (app: Express) => {
  app.get("/entitlements/aquecedor", (req, res) => {
    const auth = resolveRequestAuth(req);
    const entitlement = entitlementService.getAquecedorEntitlement(auth.email, auth.role);
    return res.status(200).json({
      ...entitlement,
      role: auth.role,
    });
  });
};
