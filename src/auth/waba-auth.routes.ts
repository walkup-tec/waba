import type { Express, Request, Response, NextFunction } from "express";
import { BASE_PATH } from "../base-path";
import { WabaSubscriberService } from "../subscribers/waba-subscriber.service";
import { isStaffRole, WabaSystemUserService } from "../users/waba-system-user.service";
import {
  createWabaSessionToken,
  getWabaAuthPublicConfig,
  isWabaAuthConfigured,
  readWabaSessionCookie,
  resolveSessionRole,
  resolveWabaSessionCookieOptions,
  validateWabaAdminCredentials,
  verifyWabaSessionToken,
} from "./waba-auth.service";

const subscriberService = new WabaSubscriberService();
const systemUserService = new WabaSystemUserService();

const writeSessionCookie = (res: Response, token: string) => {
  const cookie = resolveWabaSessionCookieOptions(BASE_PATH);
  const cookieParts = [
    `${cookie.name}=${encodeURIComponent(token)}`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    "HttpOnly",
    `SameSite=${cookie.sameSite}`,
  ];
  if (cookie.secure) cookieParts.push("Secure");
  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

const clearSessionCookie = (res: Response) => {
  const cookie = resolveWabaSessionCookieOptions(BASE_PATH);
  const cookieParts = [
    `${cookie.name}=`,
    `Path=${cookie.path}`,
    "Max-Age=0",
    "HttpOnly",
    `SameSite=${cookie.sameSite}`,
  ];
  if (cookie.secure) cookieParts.push("Secure");
  res.setHeader("Set-Cookie", cookieParts.join("; "));
};

const sendSession = (req: Request, res: Response) => {
  const config = getWabaAuthPublicConfig();
  if (!config.authConfigured) {
    clearSessionCookie(res);
    return res.status(200).json({
      authenticated: false,
      authConfigured: false,
      email: "",
      role: "",
    });
  }

  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) {
    if (token) clearSessionCookie(res);
    return res.status(200).json({
      authenticated: false,
      authConfigured: true,
      email: "",
      role: "",
    });
  }

  const role = resolveSessionRole(session);
  const profile =
    role === "subscriber" ? subscriberService.getPublicProfile(session.email) : null;
  const systemUser =
    isStaffRole(role) ? systemUserService.getByEmail(session.email) : null;
  const menuAccess = isStaffRole(role)
    ? systemUserService.getSessionMenuAccess(session.email)
    : null;
  const canOpenSupportTickets = Boolean(session.email) && !isStaffRole(role);

  return res.status(200).json({
    authenticated: true,
    authConfigured: true,
    email: session.email,
    role,
    canOpenSupportTickets,
    subscriber: profile,
    systemUser: systemUser
      ? {
          id: systemUser.id,
          fullName: systemUser.fullName,
          email: systemUser.email,
          role: systemUser.role,
          operacionalDispatchesApi: systemUser.operacionalDispatchesApi ?? null,
        }
      : null,
    operacionalDispatchesApi: systemUser?.operacionalDispatchesApi ?? null,
    allowedMenuIds: menuAccess?.allowedMenuIds ?? [],
    menuPermissions: menuAccess?.menuPermissions ?? null,
  });
};

const isAuthBypassPath = (method: string, reqPath: string): boolean => {
  const p = String(reqPath || "/").replace(/\/+$/, "") || "/";

  if (p === "/auth/login" && method === "POST") return true;
  if (p === "/auth/logout" && method === "POST") return true;
  if (p === "/auth/force-logout" && method === "GET") return true;
  if (p === "/auth/session" && (method === "GET" || method === "HEAD")) return true;
  if (p === "/subscribers/register" && method === "POST") return true;
  if (p === "/subscribers/login" && method === "POST") return true;

  if (p === "/webhooks/asaas" || p === "/webhooks/evolution") return true;
  if (p === "/webhooks/asaas/transfer-authorization") return true;

  if (method === "OPTIONS") return true;

  if (method !== "GET" && method !== "HEAD") return false;

  if (p === "/health" || p === "/ready" || p === "/service/maintenance" || p === "/maintenance") {
    return true;
  }

  if (
    p === "/" ||
    p === "/index.html" ||
    p === "/cadastro" ||
    p === "/vendas" ||
    p === "/favicon.ico" ||
    p === "/logo.png" ||
    p === "/drax-logo.png" ||
    p.startsWith("/media/") ||
    p.startsWith("/push/public-media/") ||
    p === "/instancias/avatar"
  ) {
    return true;
  }

  return /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(p);
};

export const wabaRequireAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!isWabaAuthConfigured()) {
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    if (runtime === "production") {
      return res.status(503).json({
        error: "Login não configurado. Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD no servidor.",
      });
    }
    return next();
  }

  if (isAuthBypassPath(req.method, req.path)) {
    return next();
  }

  const token = readWabaSessionCookie(req.headers.cookie);
  const session = verifyWabaSessionToken(token);
  if (!session) {
    return res.status(401).json({ error: "Sessão expirada ou não autenticado." });
  }

  const role = resolveSessionRole(session);
  (req as Request & { wabaAuth?: { email: string; role: string } }).wabaAuth = {
    email: session.email,
    role,
  };
  return next();
};

export const registerWabaAuthRoutes = (app: Express) => {
  app.get("/auth/session", (req, res) => sendSession(req, res));

  app.post("/auth/login", (req, res) => {
    try {
      if (!isWabaAuthConfigured()) {
        return res.status(503).json({
          error: "Login não configurado. Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD no servidor.",
        });
      }

      const body = req.body as Record<string, unknown>;
      const email = String(body.email ?? body.username ?? "");
      const password = String(body.password ?? "");

      if (systemUserService.validateCredentials(email, password)) {
        const user = systemUserService.getByEmail(email);
        if (!user) {
          return res.status(401).json({ error: "E-mail ou senha inválidos." });
        }
        const token = createWabaSessionToken(user.email, user.role);
        writeSessionCookie(res, token);
        const menuAccess = systemUserService.getSessionMenuAccess(user.email);
        return res.status(200).json({
          ok: true,
          email: user.email,
          role: user.role,
          systemUser: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            operacionalDispatchesApi: user.operacionalDispatchesApi ?? null,
          },
          operacionalDispatchesApi: user.operacionalDispatchesApi ?? null,
          allowedMenuIds: menuAccess.allowedMenuIds,
          menuPermissions: menuAccess.menuPermissions,
        });
      }

      if (validateWabaAdminCredentials(email, password)) {
        const token = createWabaSessionToken(email, "master");
        writeSessionCookie(res, token);
        return res.status(200).json({
          ok: true,
          email: email.trim().toLowerCase(),
          role: "master",
        });
      }

      if (subscriberService.validateCredentials(email, password)) {
        const token = createWabaSessionToken(email, "subscriber");
        writeSessionCookie(res, token);
        const profile = subscriberService.getPublicProfile(email);
        return res.status(200).json({
          ok: true,
          email: profile?.email ?? email.trim().toLowerCase(),
          role: "subscriber",
          subscriber: profile,
        });
      }

      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    } catch (error) {
      console.error("[auth/login] erro:", error);
      return res.status(500).json({
        error: "Erro temporário ao processar login. Tente novamente em instantes.",
      });
    }
  });

  app.post("/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  });

  app.get("/auth/force-logout", (_req, res) => {
    clearSessionCookie(res);
    const base = BASE_PATH && BASE_PATH !== "/" ? BASE_PATH : "";
    return res.redirect(302, `${base}/`);
  });
};
