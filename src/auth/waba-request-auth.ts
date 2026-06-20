import type { Request } from "express";
import {
  readWabaSessionCookie,
  resolveSessionRole,
  verifyWabaSessionToken,
  type WabaSessionRole,
} from "./waba-auth.service";

export type WabaRequestAuth = {
  email: string;
  role: WabaSessionRole | "guest";
};

export const resolveWabaRequestAuth = (req: Request): WabaRequestAuth => {
  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) return { email: "", role: "guest" };
  return {
    email: session.email,
    role: resolveSessionRole(session),
  };
};
