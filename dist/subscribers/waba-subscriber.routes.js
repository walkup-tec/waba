"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaSubscriberRoutes = void 0;
const base_path_1 = require("../base-path");
const waba_auth_service_1 = require("../auth/waba-auth.service");
const waba_subscriber_service_1 = require("./waba-subscriber.service");
const subscriberService = new waba_subscriber_service_1.WabaSubscriberService();
const resolveAppLoginUrl = () => {
    const fromEnv = String(process.env.WABA_APP_LOGIN_URL ?? "").trim();
    if (fromEnv)
        return fromEnv;
    const base = base_path_1.BASE_PATH || "";
    return `http://localhost:${process.env.PORT || 3012}${base}/`;
};
const registerWabaSubscriberRoutes = (app) => {
    app.post("/subscribers/register", (req, res) => {
        try {
            const body = req.body;
            const profile = subscriberService.register({
                email: String(body.email ?? ""),
                password: String(body.password ?? ""),
                fullName: String(body.fullName ?? body.name ?? ""),
                whatsapp: String(body.whatsapp ?? ""),
                phone: String(body.phone ?? ""),
                cpfCnpj: String(body.cpfCnpj ?? ""),
                segment: body.segment,
                signupOrigin: body.signupOrigin ?? body.signupSource,
            }, {
                requestHeaders: {
                    origin: String(req.headers.origin ?? ""),
                    referer: String(req.headers.referer ?? ""),
                },
            });
            const loginUrl = resolveAppLoginUrl();
            return res.status(201).json({
                ok: true,
                subscriber: profile,
                loginUrl,
                message: "Cadastro realizado. Faça login no painel WABA para contratar disparos.",
            });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível concluir o cadastro.",
            });
        }
    });
    app.post("/subscribers/login", (req, res) => {
        try {
            const body = req.body;
            const email = String(body.email ?? "");
            const password = String(body.password ?? "");
            if (!subscriberService.validateCredentials(email, password)) {
                return res.status(401).json({ error: "E-mail ou senha inválidos." });
            }
            const token = (0, waba_auth_service_1.createWabaSessionToken)(email, "subscriber");
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
            const profile = subscriberService.getPublicProfile(email);
            return res.status(200).json({
                ok: true,
                email: profile?.email ?? email.trim().toLowerCase(),
                role: "subscriber",
                subscriber: profile,
            });
        }
        catch (error) {
            return res.status(400).json({
                error: error instanceof Error ? error.message : "Não foi possível entrar.",
            });
        }
    });
};
exports.registerWabaSubscriberRoutes = registerWabaSubscriberRoutes;
