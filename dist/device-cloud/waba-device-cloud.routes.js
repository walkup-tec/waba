"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeviceCloudEmailAllowed = isDeviceCloudEmailAllowed;
exports.registerDeviceCloudRoutes = registerDeviceCloudRoutes;
const multer_1 = __importDefault(require("multer"));
const waba_request_auth_1 = require("../auth/waba-request-auth");
const waba_device_cloud_service_1 = require("./waba-device-cloud.service");
const DEVICE_CLOUD_ALLOWLIST = new Set(["mozart.pmo@gmail.com"]);
const DEVICE_CLOUD_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const DEVICE_CLOUD_MEDIA_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadDeviceCloudMedia = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: DEVICE_CLOUD_MEDIA_MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!DEVICE_CLOUD_MEDIA_MIME.has(String(file.mimetype || "").toLowerCase())) {
            cb(new Error("Use JPG, PNG ou WebP."));
            return;
        }
        cb(null, true);
    },
});
function isDeviceCloudEmailAllowed(email) {
    return DEVICE_CLOUD_ALLOWLIST.has(String(email || "").trim().toLowerCase());
}
function isDeviceCloudProductionProfile() {
    const explicit = String(process.env.WABA_UI_PROFILE || "").trim().toLowerCase();
    if (explicit === "production")
        return true;
    if (explicit === "full" || explicit === "baseline")
        return false;
    const env = String(process.env.WABA_ENV || "").trim().toLowerCase();
    return env !== "v01";
}
function requireDeviceCloudUser(req, res) {
    if (!isDeviceCloudProductionProfile()) {
        res.status(403).json({ error: "Device Cloud disponível apenas no perfil production." });
        return null;
    }
    const auth = (0, waba_request_auth_1.resolveWabaRequestAuth)(req);
    const email = String(auth.email || "").trim().toLowerCase();
    if (!email || !isDeviceCloudEmailAllowed(email)) {
        res.status(403).json({ error: "Conta não autorizada para Device Cloud." });
        return null;
    }
    if (!waba_device_cloud_service_1.wabaDeviceCloudService.isConfigured()) {
        res.status(503).json({ error: "DEVICE_CLOUD_SSO_SECRET não configurado no ambiente." });
        return null;
    }
    return { email };
}
function sendDeviceCloudError(res, err) {
    if (err instanceof waba_device_cloud_service_1.DeviceCloudHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    res.status(502).json({ error: "Falha ao falar com o Device Cloud." });
}
function readCoord(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 4096) {
        throw new waba_device_cloud_service_1.DeviceCloudHttpError(`Coordenada ${name} inválida.`, 400);
    }
    return Math.round(n);
}
function registerDeviceCloudRoutes(app) {
    app.get("/device-cloud/devices", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        try {
            const devices = await waba_device_cloud_service_1.wabaDeviceCloudService.listDevicesForUser(user.email);
            return res.json({ ok: true, devices });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/devices", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const name = String(req.body?.name || "").trim();
        try {
            const device = await waba_device_cloud_service_1.wabaDeviceCloudService.createNewDevice(user.email, name || undefined);
            return res.json({ ok: true, device });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device", (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        try {
            const session = waba_device_cloud_service_1.wabaDeviceCloudService.bootstrap(user.email);
            return res.json({
                ok: true,
                apiUrl: session.apiUrl,
                ssoToken: session.ssoToken,
                expiresInSec: session.expiresInSec,
            });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.get("/device-cloud/device/:id/screenshot", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        if (!(0, waba_device_cloud_service_1.isDeviceCloudDeviceId)(id)) {
            return res.status(400).json({ error: "Dispositivo inválido." });
        }
        try {
            const png = await waba_device_cloud_service_1.wabaDeviceCloudService.screenshotPng(user.email, id);
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Cache-Control", "no-store");
            return res.send(png);
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/launch-whatsapp-business", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        if (!(0, waba_device_cloud_service_1.isDeviceCloudDeviceId)(id)) {
            return res.status(400).json({ error: "Dispositivo inválido." });
        }
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.launchWhatsAppBusiness(user.email, id);
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/restart", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        if (!(0, waba_device_cloud_service_1.isDeviceCloudDeviceId)(id)) {
            return res.status(400).json({ error: "Dispositivo inválido." });
        }
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.restartDevice(user.email, id);
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.patch("/device-cloud/device/:id", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        if (!(0, waba_device_cloud_service_1.isDeviceCloudDeviceId)(id)) {
            return res.status(400).json({ error: "Dispositivo inválido." });
        }
        const name = String(req.body?.name || "").trim();
        if (!name || name.length > 40) {
            return res.status(400).json({ error: "Informe um nome de até 40 caracteres." });
        }
        try {
            const device = await waba_device_cloud_service_1.wabaDeviceCloudService.renameDevice(user.email, id, name);
            return res.json({ ok: true, name: device.name, device });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/push-media", (req, res, next) => {
        uploadDeviceCloudMedia.single("file")(req, res, (err) => {
            if (err) {
                const limitErr = err instanceof multer_1.default.MulterError && err.code === "LIMIT_FILE_SIZE";
                return res.status(400).json({
                    error: limitErr ? "Imagem até 5 MB." : err.message || "Falha no upload.",
                });
            }
            next();
        });
    }, async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        if (!(0, waba_device_cloud_service_1.isDeviceCloudDeviceId)(id)) {
            return res.status(400).json({ error: "Dispositivo inválido." });
        }
        const file = req.file;
        if (!file?.buffer?.length) {
            return res.status(400).json({ error: "Selecione uma imagem do seu computador." });
        }
        const kind = String(req.body?.kind || "profile").trim().toLowerCase();
        const prefix = kind === "cover" ? "waba-capa" : "waba-perfil";
        const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
        const filename = `${prefix}-${Date.now()}.${ext}`;
        try {
            const result = await waba_device_cloud_service_1.wabaDeviceCloudService.pushDownloadFile(user.email, id, {
                filename,
                buffer: file.buffer,
            });
            return res.json({ ok: true, remotePath: result.remotePath, filename });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/input/tap", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.inputTap(user.email, id, readCoord(req.body?.x, "x"), readCoord(req.body?.y, "y"));
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/input/swipe", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.inputSwipe(user.email, id, {
                x1: readCoord(req.body?.x1, "x1"),
                y1: readCoord(req.body?.y1, "y1"),
                x2: readCoord(req.body?.x2, "x2"),
                y2: readCoord(req.body?.y2, "y2"),
                durationMs: Math.max(150, Math.min(800, Math.round(Number(req.body?.durationMs ?? 280)))),
            });
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/input/text", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        const text = String(req.body?.text || "");
        if (!text || text.length > 200) {
            return res.status(400).json({ error: "Texto inválido." });
        }
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.inputText(user.email, id, text);
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
    app.post("/device-cloud/device/:id/input/key", async (req, res) => {
        const user = requireDeviceCloudUser(req, res);
        if (!user)
            return;
        const id = String(req.params.id || "");
        const key = String(req.body?.key || "").trim().toLowerCase();
        if (key !== "back" && key !== "home" && key !== "enter" && key !== "del" && key !== "delete") {
            return res.status(400).json({ error: "Tecla inválida." });
        }
        try {
            await waba_device_cloud_service_1.wabaDeviceCloudService.inputKey(user.email, id, key);
            return res.json({ ok: true });
        }
        catch (err) {
            return sendDeviceCloudError(res, err);
        }
    });
}
