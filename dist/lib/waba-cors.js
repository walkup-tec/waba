"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaCors = void 0;
const resolveAllowedOrigins = () => {
    const defaults = [
        "http://localhost:3013",
        "http://127.0.0.1:3013",
        "https://wabadisparos.com.br",
        "https://www.wabadisparos.com.br",
        "https://bet.waba.info",
    ];
    const raw = String(process.env.WABA_CORS_ORIGINS ?? "").trim();
    const items = raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    return [...new Set([...defaults, ...items])];
};
const registerWabaCors = (app) => {
    const allowedOrigins = new Set(resolveAllowedOrigins());
    app.use((req, res, next) => {
        const origin = String(req.headers.origin ?? "").trim();
        if (origin && allowedOrigins.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
        if (req.method === "OPTIONS") {
            return res.status(204).end();
        }
        return next();
    });
};
exports.registerWabaCors = registerWabaCors;
