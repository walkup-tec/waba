"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaDeviceCloudService = exports.WabaDeviceCloudService = exports.DeviceCloudHttpError = void 0;
exports.isDeviceCloudDeviceId = isDeviceCloudDeviceId;
const crypto_1 = __importDefault(require("crypto"));
const SSO_AUDIENCE = "drax-device-cloud";
const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_FALLBACK = "https://api-devices.draxsistemas.com.br";
class DeviceCloudHttpError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
exports.DeviceCloudHttpError = DeviceCloudHttpError;
const tokenCache = new Map();
const trimEnv = (value) => String(value ?? "").trim();
function isDeviceCloudDeviceId(id) {
    return DEVICE_ID_RE.test(id);
}
class WabaDeviceCloudService {
    apiUrl() {
        const explicit = trimEnv(process.env.DEVICE_CLOUD_API_URL).replace(/\/$/, "");
        if (explicit)
            return explicit;
        const publicUrl = trimEnv(process.env.DEVICE_CLOUD_PUBLIC_URL).replace(/\/$/, "");
        if (!publicUrl)
            return API_FALLBACK;
        if (publicUrl.includes("://api-devices.draxsistemas.com.br"))
            return publicUrl;
        if (publicUrl.includes("://devices.draxsistemas.com.br"))
            return API_FALLBACK;
        return publicUrl;
    }
    ssoSecret() {
        return trimEnv(process.env.DEVICE_CLOUD_SSO_SECRET);
    }
    isConfigured() {
        return Boolean(this.ssoSecret());
    }
    bootstrap(email) {
        const secret = this.ssoSecret();
        if (!secret) {
            throw new DeviceCloudHttpError("Device Cloud não configurado no ambiente.", 503);
        }
        return {
            apiUrl: this.apiUrl(),
            ssoToken: this.signSsoToken(String(email || "").trim().toLowerCase(), secret),
            expiresInSec: 300,
        };
    }
    async ensureDevice(email) {
        const token = await this.accessToken(email);
        const existing = await this.listDevices(token);
        const online = existing.find((d) => String(d.status || "").toUpperCase() === "ONLINE");
        if (online?.id)
            return online;
        const ready = existing.find((d) => {
            const status = String(d.status || "").toUpperCase();
            return Boolean(d.id) && status !== "ERROR";
        });
        if (ready?.id)
            return ready;
        if (existing.length > 0) {
            throw new DeviceCloudHttpError("O celular virtual não está pronto. Tente de novo em alguns segundos.", 502);
        }
        const created = await this.createDevice(token, "Android");
        const createdStatus = String(created.status || "").toUpperCase();
        if (created.id && createdStatus !== "ERROR")
            return created;
        const retry = await this.listDevices(token);
        const retryOnline = retry.find((d) => String(d.status || "").toUpperCase() === "ONLINE");
        if (retryOnline?.id)
            return retryOnline;
        throw new DeviceCloudHttpError("Não foi possível criar o dispositivo.", 502);
    }
    async screenshotPng(email, deviceId) {
        this.assertDeviceId(deviceId);
        const token = await this.accessToken(email);
        const res = await this.apiFetch(`/devices/${deviceId}/screenshot`, {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            timeoutMs: 20000,
        });
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok) {
            throw new DeviceCloudHttpError(this.safeMessage(buf.toString("utf8"), "Falha ao capturar a tela."), res.status);
        }
        return buf;
    }
    async inputTap(email, deviceId, x, y) {
        await this.input(email, deviceId, "tap", { x, y });
    }
    async inputSwipe(email, deviceId, body) {
        await this.input(email, deviceId, "swipe", body);
    }
    async inputText(email, deviceId, text) {
        await this.input(email, deviceId, "text", { text });
    }
    async inputKey(email, deviceId, key) {
        await this.input(email, deviceId, "key", { key });
    }
    async launchWhatsAppBusiness(email, deviceId) {
        this.assertDeviceId(deviceId);
        const token = await this.accessToken(email);
        const res = await this.apiFetch(`/devices/${deviceId}/launch-whatsapp-business`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            body: "{}",
            timeoutMs: 30000,
        });
        if (!res.ok) {
            const raw = await res.text().catch(() => "");
            throw new DeviceCloudHttpError(this.safeMessage(raw, "Não foi possível abrir o WhatsApp Business."), res.status);
        }
    }
    async input(email, deviceId, path, body) {
        this.assertDeviceId(deviceId);
        const token = await this.accessToken(email);
        const res = await this.apiFetch(`/devices/${deviceId}/input/${path}`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
            timeoutMs: 15000,
        });
        if (!res.ok) {
            const raw = await res.text().catch(() => "");
            throw new DeviceCloudHttpError(this.safeMessage(raw, "Falha no toque na tela."), res.status);
        }
    }
    async accessToken(email) {
        const normalized = String(email || "").trim().toLowerCase();
        const cached = tokenCache.get(normalized);
        if (cached && cached.expMs > Date.now() + 30000)
            return cached.accessToken;
        const secret = this.ssoSecret();
        if (!secret) {
            throw new DeviceCloudHttpError("Device Cloud não configurado no ambiente.", 503);
        }
        const ssoToken = this.signSsoToken(normalized, secret);
        const res = await this.apiFetch("/auth/sso", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ssoToken }),
            timeoutMs: 15000,
        });
        const payload = (await res.json().catch(() => null));
        if (!res.ok || !payload?.accessToken) {
            if (res.status === 401) {
                throw new DeviceCloudHttpError("Acesso ao Device Cloud recusado. Confira DEVICE_CLOUD_SSO_SECRET no EasyPanel (igual ao worker AWS).", 502);
            }
            throw new DeviceCloudHttpError("Não foi possível abrir o dispositivo. Tente de novo.", 502);
        }
        tokenCache.set(normalized, {
            accessToken: payload.accessToken,
            expMs: Date.now() + 90 * 60 * 1000,
        });
        return payload.accessToken;
    }
    async listDevices(token) {
        const res = await this.apiFetch("/devices", {
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            timeoutMs: 20000,
        });
        const payload = (await res.json().catch(() => null));
        if (!res.ok) {
            throw new DeviceCloudHttpError("Não foi possível listar o dispositivo.", res.status === 401 ? 502 : res.status);
        }
        return Array.isArray(payload) ? payload : [];
    }
    async createDevice(token, name) {
        const res = await this.apiFetch("/devices", {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({ name }),
            timeoutMs: 180000,
        });
        const payload = (await res.json().catch(() => null));
        if (!res.ok || !payload || !("id" in payload) || !payload.id) {
            const msg = payload && "message" in payload
                ? this.safeMessage(String(payload.message || payload.error || ""), "Não foi possível criar o dispositivo.")
                : "Não foi possível criar o dispositivo.";
            throw new DeviceCloudHttpError(msg, res.status >= 400 ? res.status : 502);
        }
        return payload;
    }
    signSsoToken(email, secret) {
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: email,
            email,
            aud: SSO_AUDIENCE,
            exp: now + 300,
            iat: now,
            tenant: trimEnv(process.env.DEVICE_CLOUD_DEFAULT_TENANT_ID) || "00000000-0000-4000-8000-000000000001",
            userId: trimEnv(process.env.DEVICE_CLOUD_DEFAULT_USER_ID) || "00000000-0000-4000-8000-000000000011",
            role: "admin",
        };
        const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
        const sig = crypto_1.default.createHmac("sha256", secret).update(body).digest("base64url");
        return `${body}.${sig}`;
    }
    assertDeviceId(id) {
        if (!isDeviceCloudDeviceId(id)) {
            throw new DeviceCloudHttpError("Dispositivo inválido.", 400);
        }
    }
    async apiFetch(path, opts) {
        const base = this.apiUrl();
        try {
            return await fetch(`${base}${path}`, {
                method: opts.method,
                headers: opts.headers,
                body: opts.body,
                signal: AbortSignal.timeout(opts.timeoutMs),
            });
        }
        catch {
            throw new DeviceCloudHttpError("Device Cloud indisponível no momento.", 502);
        }
    }
    safeMessage(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            const msg = String(parsed.message || parsed.error || "").trim();
            if (!msg)
                return fallback;
            if (/secret|token|jwt|hmac|key/i.test(msg))
                return fallback;
            return msg.slice(0, 180);
        }
        catch {
            return fallback;
        }
    }
}
exports.WabaDeviceCloudService = WabaDeviceCloudService;
exports.wabaDeviceCloudService = new WabaDeviceCloudService();
