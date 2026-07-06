"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaGracefulShutdown = exports.registerWabaShutdownGate = exports.isWabaServerShuttingDown = void 0;
const SHUTDOWN_GRACE_MS = Math.max(5000, Math.min(120000, Number(process.env.SHUTDOWN_GRACE_MS || 25000) || 25000));
let shuttingDown = false;
const isStaticRequestDuringShutdown = (method, reqPath) => {
    if (method !== "GET" && method !== "HEAD")
        return false;
    const p = String(reqPath || "/").replace(/\/+$/, "") || "/";
    if (p === "/" ||
        p === "/index.html" ||
        p === "/sw-deploy-resilience.js" ||
        p === "/maintenance") {
        return true;
    }
    return /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map)$/i.test(p);
};
const isWabaServerShuttingDown = () => shuttingDown;
exports.isWabaServerShuttingDown = isWabaServerShuttingDown;
/** Deve ser registrado cedo (antes das rotas de API) para responder 503 durante o deploy. */
const registerWabaShutdownGate = (app) => {
    app.use((req, res, next) => {
        if (!shuttingDown)
            return next();
        const p = String(req.path || "/").replace(/\/+$/, "") || "/";
        if (p === "/health" || p === "/ready")
            return next();
        if (p === "/auth/session" && req.method === "GET")
            return next();
        if (isStaticRequestDuringShutdown(req.method, req.path))
            return next();
        res.set("Retry-After", "15");
        res.set("Connection", "close");
        return res.status(503).json({
            ok: false,
            shuttingDown: true,
            message: "Servidor em atualização. Tente novamente em instantes.",
            retryAfterSec: 15,
        });
    });
};
exports.registerWabaShutdownGate = registerWabaShutdownGate;
const registerWabaGracefulShutdown = (server) => {
    const close = (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log(`[shutdown] ${signal} — drenando conexões (até ${Math.round(SHUTDOWN_GRACE_MS / 1000)}s); /health retorna 503 até encerrar.`);
        server.close((err) => {
            if (err) {
                console.error("[shutdown] erro ao fechar servidor:", err);
                process.exit(1);
                return;
            }
            console.log("[shutdown] servidor encerrado com sucesso.");
            process.exit(0);
        });
        setTimeout(() => {
            console.warn("[shutdown] tempo esgotado — encerramento forçado.");
            process.exit(1);
        }, SHUTDOWN_GRACE_MS).unref();
    };
    process.once("SIGTERM", () => close("SIGTERM"));
    process.once("SIGINT", () => close("SIGINT"));
};
exports.registerWabaGracefulShutdown = registerWabaGracefulShutdown;
