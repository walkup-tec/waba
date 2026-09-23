"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdsPowerIngestRoute = registerAdsPowerIngestRoute;
exports.registerAdsPowerLabRoutes = registerAdsPowerLabRoutes;
const waba_request_auth_1 = require("../../auth/waba-request-auth");
const waba_adspower_service_1 = require("./waba-adspower.service");
function sendError(res, error) {
    const status = Number(error?.status || 400);
    const message = error instanceof Error ? error.message : "Falha AdsPower.";
    return res.status(status).json({ ok: false, error: message });
}
/** Ingest do PC com AdsPower — registrar ANTES do middleware de sessão. */
function registerAdsPowerIngestRoute(app) {
    app.post("/integrations/adspower/ingest", (req, res) => {
        try {
            (0, waba_adspower_service_1.assertAdsPowerIngestAuthorized)(req.headers.authorization);
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const items = Array.isArray(body.profiles)
                ? body.profiles
                : Array.isArray(body.list)
                    ? body.list
                    : [];
            const prune = body.prune !== false && body.replace !== false;
            const result = waba_adspower_service_1.wabaAdsPowerService.ingest(items, { prune });
            return res.status(200).json({ ok: true, ...result });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
}
function registerAdsPowerLabRoutes(app) {
    app.get("/integrations/adspower/status", async (_req, res) => {
        try {
            const bridge = await waba_adspower_service_1.wabaAdsPowerService.status();
            return res.status(200).json({ ok: true, bridge });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
    app.get("/integrations/adspower/profiles", async (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const profiles = waba_adspower_service_1.wabaAdsPowerService.list(auth);
            const bridge = await waba_adspower_service_1.wabaAdsPowerService.status();
            return res.status(200).json({ ok: true, bridge, profiles });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
    app.post("/integrations/adspower/sync", async (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const result = await waba_adspower_service_1.wabaAdsPowerService.pullFromLocalApi(auth);
            const bridge = await waba_adspower_service_1.wabaAdsPowerService.status();
            return res.status(200).json({ ok: true, bridge, ...result });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
    app.post("/integrations/adspower/profiles/:userId/bind", (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const profile = waba_adspower_service_1.wabaAdsPowerService.bind(auth, String(req.params.userId || ""), {
                connectionId: String(body.connectionId || ""),
                wabaId: String(body.wabaId || ""),
                phoneNumberId: String(body.phoneNumberId || ""),
                displayPhoneNumber: String(body.displayPhoneNumber || ""),
                verifiedName: String(body.verifiedName || ""),
            });
            return res.status(200).json({ ok: true, profile });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
    app.post("/integrations/adspower/profiles/:userId/unbind", (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const profile = waba_adspower_service_1.wabaAdsPowerService.unbind(auth, String(req.params.userId || ""));
            return res.status(200).json({ ok: true, profile });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
    app.post("/integrations/adspower/profiles/:userId/open", async (req, res) => {
        try {
            const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            const result = await waba_adspower_service_1.wabaAdsPowerService.open(auth, String(req.params.userId || ""));
            return res.status(200).json({ ok: true, ...result });
        }
        catch (error) {
            return sendError(res, error);
        }
    });
}
