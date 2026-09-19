"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWabaBotRoutes = registerWabaBotRoutes;
const multer_1 = __importDefault(require("multer"));
const waba_request_auth_1 = require("../../../auth/waba-request-auth");
const meta_whatsapp_errors_1 = require("../meta-whatsapp-errors");
const meta_whatsapp_connection_service_1 = require("../meta-whatsapp-connection.service");
const waba_bot_service_1 = require("./waba-bot.service");
const uploadBotMedia = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024, files: 1 },
});
const service = new waba_bot_service_1.WabaBotService();
function sendPublic(res, status, payload) {
    return res.status(status).json((0, meta_whatsapp_connection_service_1.stripMetaSecrets)(payload));
}
function handleMetaError(res, error) {
    const publicError = (0, meta_whatsapp_errors_1.toPublicMetaError)(error);
    (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("http-error", { code: publicError.code, status: publicError.status });
    return sendPublic(res, publicError.status, {
        ok: false,
        error: publicError.error,
        code: publicError.code,
    });
}
function warnClientTenantClaim(req) {
    const body = req.body;
    if (body?.tenant_id || body?.tenantId || body?.owner_email || body?.ownerEmail) {
        (0, meta_whatsapp_errors_1.logMetaWhatsappSafe)("ignored-client-tenant", {});
    }
}
function registerWabaBotRoutes(app) {
    app.get("/integrations/meta/whatsapp/bots", async (req, res) => {
        try {
            const result = await service.list((0, waba_request_auth_1.resolveWabaRequestAuth)(req));
            return sendPublic(res, 200, { ok: true, ...result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/bots/catalog", async (req, res) => {
        try {
            (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
            return sendPublic(res, 200, { ok: true, ...service.getCatalog() });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.get("/integrations/meta/whatsapp/bots/:id", async (req, res) => {
        try {
            const flow = service.get((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""));
            return sendPublic(res, 200, { ok: true, flow });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/bots", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const flow = body.flow
                ? service.upsert((0, waba_request_auth_1.resolveWabaRequestAuth)(req), body.flow)
                : service.create((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(body.name || ""));
            return sendPublic(res, 200, { ok: true, flow });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.put("/integrations/meta/whatsapp/bots/:id", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const flow = service.upsert((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                ...body,
                id: String(req.params.id || body.id || ""),
            });
            return sendPublic(res, 200, { ok: true, flow });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.delete("/integrations/meta/whatsapp/bots/:id", async (req, res) => {
        try {
            service.remove((0, waba_request_auth_1.resolveWabaRequestAuth)(req), String(req.params.id || ""));
            return sendPublic(res, 200, { ok: true });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/bots/media", (req, res) => {
        uploadBotMedia.single("file")(req, res, async (err) => {
            if (err) {
                return sendPublic(res, 400, {
                    ok: false,
                    error: "A mídia pode ter no máximo 16 MB.",
                    code: "invalid_payload",
                });
            }
            try {
                warnClientTenantClaim(req);
                const file = req.file;
                const saved = service.saveMedia((0, waba_request_auth_1.resolveWabaRequestAuth)(req), {
                    mediaKind: String(req.body?.mediaKind || req.body?.media_kind || ""),
                    fileName: file?.originalname,
                    mime: file?.mimetype,
                    bytes: file?.buffer,
                });
                return sendPublic(res, 200, { ok: true, ...saved });
            }
            catch (error) {
                return handleMetaError(res, error);
            }
        });
    });
    app.post("/integrations/meta/whatsapp/bots/phone-link", async (req, res) => {
        try {
            warnClientTenantClaim(req);
            const result = await service.linkPhone((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, result);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/bots/test-node", async (req, res) => {
        try {
            const result = await service.testNode((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, { ok: true, result });
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/bots/test-run", async (req, res) => {
        try {
            const result = await service.startTest((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, result);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
    app.post("/integrations/meta/whatsapp/bots/test-continue", async (req, res) => {
        try {
            const result = await service.continueTest((0, waba_request_auth_1.resolveWabaRequestAuth)(req), req.body && typeof req.body === "object" ? req.body : {});
            return sendPublic(res, 200, result);
        }
        catch (error) {
            return handleMetaError(res, error);
        }
    });
}
