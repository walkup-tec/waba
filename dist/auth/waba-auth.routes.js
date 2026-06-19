"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaAuthRoutes = exports.wabaRequireAuthMiddleware = void 0;
const base_path_1 = require("../base-path");
const waba_subscriber_service_1 = require("../subscribers/waba-subscriber.service");
const waba_system_user_service_1 = require("../users/waba-system-user.service");
const waba_auth_service_1 = require("./waba-auth.service");
const subscriberService = new waba_subscriber_service_1.WabaSubscriberService();
const systemUserService = new waba_system_user_service_1.WabaSystemUserService();
const writeSessionCookie = (res, token) => {
    const cookie = (0, waba_auth_service_1.resolveWabaSessionCookieOptions)(base_path_1.BASE_PATH);
    const cookieParts = [
        `${cookie.name}=${encodeURIComponent(token)}`,
        `Path=${cookie.path}`,
        `Max-Age=${cookie.maxAge}`,
        "HttpOnly",
        `SameSite=${cookie.sameSite}`,
    ];
    if (cookie.secure)
        cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
};
const clearSessionCookie = (res) => {
    const cookie = (0, waba_auth_service_1.resolveWabaSessionCookieOptions)(base_path_1.BASE_PATH);
    const cookieParts = [
        `${cookie.name}=`,
        `Path=${cookie.path}`,
        "Max-Age=0",
        "HttpOnly",
        `SameSite=${cookie.sameSite}`,
    ];
    if (cookie.secure)
        cookieParts.push("Secure");
    res.setHeader("Set-Cookie", cookieParts.join("; "));
};
const sendSession = (req, res) => {
    const config = (0, waba_auth_service_1.getWabaAuthPublicConfig)();
    if (!config.authConfigured) {
        clearSessionCookie(res);
        return res.status(200).json({
            authenticated: false,
            authConfigured: false,
            email: "",
            role: "",
        });
    }
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session) {
        if (token)
            clearSessionCookie(res);
        return res.status(200).json({
            authenticated: false,
            authConfigured: true,
            email: "",
            role: "",
        });
    }
    const role = (0, waba_auth_service_1.resolveSessionRole)(session);
    const profile = role === "subscriber" ? subscriberService.getPublicProfile(session.email) : null;
    const systemUser = (0, waba_system_user_service_1.isStaffRole)(role) ? systemUserService.getByEmail(session.email) : null;
    const menuAccess = (0, waba_system_user_service_1.isStaffRole)(role)
        ? systemUserService.getSessionMenuAccess(session.email)
        : null;
    const canOpenSupportTickets = Boolean(session.email) && !(0, waba_system_user_service_1.isStaffRole)(role);
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
const isAuthBypassPath = (method, reqPath) => {
    const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
    if (p === "/auth/login" && method === "POST")
        return true;
    if (p === "/auth/logout" && method === "POST")
        return true;
    if (p === "/auth/force-logout" && method === "GET")
        return true;
    if (p === "/auth/session" && (method === "GET" || method === "HEAD"))
        return true;
    if (p === "/subscribers/register" && method === "POST")
        return true;
    if (p === "/subscribers/login" && method === "POST")
        return true;
    if (p === "/webhooks/asaas" || p === "/webhooks/evolution")
        return true;
    if (p === "/webhooks/asaas/transfer-authorization")
        return true;
    if (method === "OPTIONS")
        return true;
    if (method !== "GET" && method !== "HEAD")
        return false;
    if (p === "/health" || p === "/ready" || p === "/service/maintenance" || p === "/maintenance") {
        return true;
    }
    if (p === "/" ||
        p === "/index.html" ||
        p === "/cadastro" ||
        p === "/vendas" ||
        p === "/favicon.ico" ||
        p === "/logo.png" ||
        p === "/drax-logo.png" ||
        p.startsWith("/media/") ||
        p === "/instancias/avatar") {
        return true;
    }
    return /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(p);
};
const wabaRequireAuthMiddleware = (req, res, next) => {
    if (!(0, waba_auth_service_1.isWabaAuthConfigured)()) {
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
    const token = (0, waba_auth_service_1.readWabaSessionCookie)(req.headers.cookie);
    const session = (0, waba_auth_service_1.verifyWabaSessionToken)(token);
    if (!session) {
        return res.status(401).json({ error: "Sessão expirada ou não autenticado." });
    }
    const role = (0, waba_auth_service_1.resolveSessionRole)(session);
    req.wabaAuth = {
        email: session.email,
        role,
    };
    return next();
};
exports.wabaRequireAuthMiddleware = wabaRequireAuthMiddleware;
const registerWabaAuthRoutes = (app) => {
    app.get("/auth/session", (req, res) => sendSession(req, res));
    app.post("/auth/login", (req, res) => {
        if (!(0, waba_auth_service_1.isWabaAuthConfigured)()) {
            return res.status(503).json({
                error: "Login não configurado. Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD no servidor.",
            });
        }
        const body = req.body;
        const email = String(body.email ?? body.username ?? "");
        const password = String(body.password ?? "");
        if (systemUserService.validateCredentials(email, password)) {
            const user = systemUserService.getByEmail(email);
            if (!user) {
                return res.status(401).json({ error: "E-mail ou senha inválidos." });
            }
            const token = (0, waba_auth_service_1.createWabaSessionToken)(user.email, user.role);
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
        if ((0, waba_auth_service_1.validateWabaAdminCredentials)(email, password)) {
            const token = (0, waba_auth_service_1.createWabaSessionToken)(email, "master");
            writeSessionCookie(res, token);
            return res.status(200).json({
                ok: true,
                email: email.trim().toLowerCase(),
                role: "master",
            });
        }
        if (subscriberService.validateCredentials(email, password)) {
            const token = (0, waba_auth_service_1.createWabaSessionToken)(email, "subscriber");
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
    });
    app.post("/auth/logout", (_req, res) => {
        clearSessionCookie(res);
        return res.status(200).json({ ok: true });
    });
    app.get("/auth/force-logout", (_req, res) => {
        clearSessionCookie(res);
        const base = base_path_1.BASE_PATH && base_path_1.BASE_PATH !== "/" ? base_path_1.BASE_PATH : "";
        return res.redirect(302, `${base}/`);
    });
};
exports.registerWabaAuthRoutes = registerWabaAuthRoutes;
