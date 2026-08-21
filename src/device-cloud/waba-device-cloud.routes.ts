import type { Express, Request, Response } from "express";
import multer from "multer";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";
import {
  DeviceCloudHttpError,
  isDeviceCloudDeviceId,
  wabaDeviceCloudService,
} from "./waba-device-cloud.service";
import {
  resolveDeviceCloudRegisteredPhone,
  saveDeviceCloudRegisteredPhone,
} from "./waba-device-cloud-phone.service";

const DEVICE_CLOUD_ALLOWLIST = new Set(["mozart.pmo@gmail.com"]);
const DEVICE_CLOUD_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
const DEVICE_CLOUD_MEDIA_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadDeviceCloudMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEVICE_CLOUD_MEDIA_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!DEVICE_CLOUD_MEDIA_MIME.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Use JPG, PNG ou WebP."));
      return;
    }
    cb(null, true);
  },
});

export function isDeviceCloudEmailAllowed(email: string): boolean {
  return DEVICE_CLOUD_ALLOWLIST.has(String(email || "").trim().toLowerCase());
}

function isDeviceCloudProductionProfile(): boolean {
  const explicit = String(process.env.WABA_UI_PROFILE || "").trim().toLowerCase();
  if (explicit === "production") return true;
  if (explicit === "full" || explicit === "baseline") return false;
  const env = String(process.env.WABA_ENV || "").trim().toLowerCase();
  return env !== "v01";
}

function requireDeviceCloudUser(req: Request, res: Response): { email: string } | null {
  if (!isDeviceCloudProductionProfile()) {
    res.status(403).json({ error: "Device Cloud disponível apenas no perfil production." });
    return null;
  }
  const auth = resolveWabaRequestAuth(req);
  const email = String(auth.email || "").trim().toLowerCase();
  if (!email || !isDeviceCloudEmailAllowed(email)) {
    res.status(403).json({ error: "Conta não autorizada para Device Cloud." });
    return null;
  }
  if (!wabaDeviceCloudService.isConfigured()) {
    res.status(503).json({ error: "DEVICE_CLOUD_SSO_SECRET não configurado no ambiente." });
    return null;
  }
  return { email };
}

function sendDeviceCloudError(res: Response, err: unknown): void {
  if (err instanceof DeviceCloudHttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(502).json({ error: "Falha ao falar com o Device Cloud." });
}

function readCoord(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 4096) {
    throw new DeviceCloudHttpError(`Coordenada ${name} inválida.`, 400);
  }
  return Math.round(n);
}

function sniffDeviceCloudImageExt(buffer: Buffer, mimetype: string): "png" | "jpg" | "webp" {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (mimetype === "image/png") return "png";
  if (mimetype === "image/webp") return "webp";
  return "jpg";
}

export function registerDeviceCloudRoutes(app: Express): void {
  app.get("/device-cloud/devices", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    try {
      const devices = await wabaDeviceCloudService.listDevicesForUser(user.email);
      return res.json({ ok: true, devices });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/devices", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const name = String(req.body?.name || "").trim();
    try {
      const device = await wabaDeviceCloudService.createNewDevice(user.email, name || undefined);
      return res.json({ ok: true, device });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device", (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    try {
      const session = wabaDeviceCloudService.bootstrap(user.email);
      return res.json({
        ok: true,
        apiUrl: session.apiUrl,
        ssoToken: session.ssoToken,
        expiresInSec: session.expiresInSec,
      });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.get("/device-cloud/device/:id/screenshot", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    try {
      const png = await wabaDeviceCloudService.screenshotPng(user.email, id);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.send(png);
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/launch-whatsapp-business", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    try {
      await wabaDeviceCloudService.launchWhatsAppBusiness(user.email, id);
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/restart", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    try {
      await wabaDeviceCloudService.restartDevice(user.email, id);
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.patch("/device-cloud/device/:id", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    const name = String(req.body?.name || "").trim();
    if (!name || name.length > 40) {
      return res.status(400).json({ error: "Informe um nome de até 40 caracteres." });
    }
    try {
      const device = await wabaDeviceCloudService.renameDevice(user.email, id, name);
      return res.json({ ok: true, name: device.name, device });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.get("/device-cloud/device/:id/registered-phone", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    try {
      const result = await resolveDeviceCloudRegisteredPhone({
        deviceId: id,
        label: String(req.query.label || "").trim(),
        instanceName: String(req.query.instanceName || "").trim(),
      });
      return res.json({
        ok: true,
        phone: result.phone || null,
        source: result.source || null,
      });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.put("/device-cloud/device/:id/registered-phone", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    const phone = String(req.body?.phone || req.body?.phoneDigits || "").trim();
    if (!phone) {
      return res.status(400).json({ error: "Informe o número do WhatsApp." });
    }
    try {
      const saved = await saveDeviceCloudRegisteredPhone({
        deviceId: id,
        phone,
        label: String(req.body?.label || "").trim(),
        instanceName: String(req.body?.instanceName || "").trim(),
      });
      return res.json({ ok: true, phone: saved || null });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/push-media", (req: Request, res: Response, next) => {
    uploadDeviceCloudMedia.single("file")(req, res, (err) => {
      if (err) {
        const limitErr = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
        return res.status(400).json({
          error: limitErr ? "Imagem até 5 MB." : err.message || "Falha no upload.",
        });
      }
      next();
    });
  }, async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!isDeviceCloudDeviceId(id)) {
      return res.status(400).json({ error: "Dispositivo inválido." });
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Selecione uma imagem do seu computador." });
    }
    const kind = String(req.body?.kind || "profile").trim().toLowerCase();
    const prefix = kind === "cover" ? "waba-capa" : "waba-perfil";
    const ext = sniffDeviceCloudImageExt(file.buffer, String(file.mimetype || ""));
    const filename = `${prefix}-${Date.now()}.${ext}`;
    try {
      const result = await wabaDeviceCloudService.pushDownloadFile(user.email, id, {
        filename,
        buffer: file.buffer,
      });
      return res.json({ ok: true, remotePath: result.remotePath, filename });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/input/tap", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    try {
      await wabaDeviceCloudService.inputTap(user.email, id, readCoord(req.body?.x, "x"), readCoord(req.body?.y, "y"));
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/input/swipe", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    try {
      await wabaDeviceCloudService.inputSwipe(user.email, id, {
        x1: readCoord(req.body?.x1, "x1"),
        y1: readCoord(req.body?.y1, "y1"),
        x2: readCoord(req.body?.x2, "x2"),
        y2: readCoord(req.body?.y2, "y2"),
        durationMs: Math.max(150, Math.min(800, Math.round(Number(req.body?.durationMs ?? 280)))),
      });
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/input/text", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    const text = String(req.body?.text || "");
    if (!text || text.length > 200) {
      return res.status(400).json({ error: "Texto inválido." });
    }
    try {
      await wabaDeviceCloudService.inputText(user.email, id, text);
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });

  app.post("/device-cloud/device/:id/input/key", async (req: Request, res: Response) => {
    const user = requireDeviceCloudUser(req, res);
    if (!user) return;
    const id = String(req.params.id || "");
    const key = String(req.body?.key || "").trim().toLowerCase();
    if (key !== "back" && key !== "home" && key !== "enter" && key !== "del" && key !== "delete") {
      return res.status(400).json({ error: "Tecla inválida." });
    }
    try {
      await wabaDeviceCloudService.inputKey(user.email, id, key);
      return res.json({ ok: true });
    } catch (err) {
      return sendDeviceCloudError(res, err);
    }
  });
}
