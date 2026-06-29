"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaPushRoutes = void 0;
const waba_request_auth_1 = require("../auth/waba-request-auth");
const waba_auth_routes_1 = require("../auth/waba-auth.routes");
const waba_push_delivery_service_1 = require("./waba-push-delivery.service");
const registerWabaPushRoutes = (app) => {
    app.get("/push/alerts", waba_auth_routes_1.wabaRequireAuthMiddleware, (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const items = (0, waba_push_delivery_service_1.listPushAlertsForAuth)(auth);
            return res.status(200).json({ items });
        }
        catch (error) {
            console.error("GET /push/alerts", error);
            return res.status(500).json({ error: "Não foi possível carregar alertas." });
        }
    });
    app.post("/push/alerts/:id/dismiss", waba_auth_routes_1.wabaRequireAuthMiddleware, (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const ok = (0, waba_push_delivery_service_1.dismissPushAlert)(String(req.params.id || ""), auth.email || "");
            if (!ok) {
                return res.status(404).json({ error: "Alerta não encontrado." });
            }
            return res.status(200).json({ ok: true });
        }
        catch (error) {
            console.error("POST /push/alerts/:id/dismiss", error);
            return res.status(500).json({ error: "Não foi possível dispensar o alerta." });
        }
    });
};
exports.registerWabaPushRoutes = registerWabaPushRoutes;
