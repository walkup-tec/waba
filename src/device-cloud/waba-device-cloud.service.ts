import crypto from "crypto";

const SSO_AUDIENCE = "drax-device-cloud";
const DEVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_FALLBACK = "https://api-devices.draxsistemas.com.br";

export class DeviceCloudHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type DeviceCloudDevice = {
  id: string;
  name?: string;
  status?: string;
};

type CachedToken = { accessToken: string; expMs: number };

const tokenCache = new Map<string, CachedToken>();

const trimEnv = (value: unknown) => String(value ?? "").trim();

export function isDeviceCloudDeviceId(id: string): boolean {
  return DEVICE_ID_RE.test(id);
}

export class WabaDeviceCloudService {
  apiUrl(): string {
    const explicit = trimEnv(process.env.DEVICE_CLOUD_API_URL).replace(/\/$/, "");
    if (explicit) return explicit;
    const publicUrl = trimEnv(process.env.DEVICE_CLOUD_PUBLIC_URL).replace(/\/$/, "");
    if (!publicUrl) return API_FALLBACK;
    if (publicUrl.includes("://api-devices.draxsistemas.com.br")) return publicUrl;
    if (publicUrl.includes("://devices.draxsistemas.com.br")) return API_FALLBACK;
    return publicUrl;
  }

  ssoSecret(): string {
    return trimEnv(process.env.DEVICE_CLOUD_SSO_SECRET);
  }

  isConfigured(): boolean {
    return Boolean(this.ssoSecret());
  }

  async ensureDevice(email: string): Promise<DeviceCloudDevice> {
    const token = await this.accessToken(email);
    const existing = await this.listDevices(token);
    const online = existing.find((d) => String(d.status || "").toUpperCase() === "ONLINE");
    if (online?.id) return online;
    if (existing[0]?.id) return existing[0];
    try {
      return await this.createDevice(token, "Android");
    } catch (err) {
      const retry = await this.listDevices(token);
      if (retry[0]?.id) return retry[0];
      throw err;
    }
  }

  async screenshotPng(email: string, deviceId: string): Promise<Buffer> {
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

  async inputTap(email: string, deviceId: string, x: number, y: number): Promise<void> {
    await this.input(email, deviceId, "tap", { x, y });
  }

  async inputSwipe(
    email: string,
    deviceId: string,
    body: { x1: number; y1: number; x2: number; y2: number; durationMs?: number },
  ): Promise<void> {
    await this.input(email, deviceId, "swipe", body);
  }

  async inputText(email: string, deviceId: string, text: string): Promise<void> {
    await this.input(email, deviceId, "text", { text });
  }

  async inputKey(email: string, deviceId: string, key: string): Promise<void> {
    await this.input(email, deviceId, "key", { key });
  }

  private async input(
    email: string,
    deviceId: string,
    path: "tap" | "swipe" | "text" | "key",
    body: Record<string, unknown>,
  ): Promise<void> {
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

  private async accessToken(email: string): Promise<string> {
    const normalized = String(email || "").trim().toLowerCase();
    const cached = tokenCache.get(normalized);
    if (cached && cached.expMs > Date.now() + 30_000) return cached.accessToken;

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
    const payload = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (!res.ok || !payload?.accessToken) {
      throw new DeviceCloudHttpError("Não foi possível abrir o dispositivo. Tente de novo.", 502);
    }
    tokenCache.set(normalized, {
      accessToken: payload.accessToken,
      expMs: Date.now() + 90 * 60 * 1000,
    });
    return payload.accessToken;
  }

  private async listDevices(token: string): Promise<DeviceCloudDevice[]> {
    const res = await this.apiFetch("/devices", {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      timeoutMs: 20000,
    });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      throw new DeviceCloudHttpError("Não foi possível listar o dispositivo.", res.status === 401 ? 502 : res.status);
    }
    return Array.isArray(payload) ? (payload as DeviceCloudDevice[]) : [];
  }

  private async createDevice(token: string, name: string): Promise<DeviceCloudDevice> {
    const res = await this.apiFetch("/devices", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name }),
      timeoutMs: 180000,
    });
    const payload = (await res.json().catch(() => null)) as DeviceCloudDevice | { message?: string; error?: string } | null;
    if (!res.ok || !payload || !("id" in payload) || !payload.id) {
      const msg =
        payload && "message" in payload
          ? this.safeMessage(String(payload.message || payload.error || ""), "Não foi possível criar o dispositivo.")
          : "Não foi possível criar o dispositivo.";
      throw new DeviceCloudHttpError(msg, res.status >= 400 ? res.status : 502);
    }
    return payload;
  }

  private signSsoToken(email: string, secret: string): string {
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
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  private assertDeviceId(id: string): void {
    if (!isDeviceCloudDeviceId(id)) {
      throw new DeviceCloudHttpError("Dispositivo inválido.", 400);
    }
  }

  private async apiFetch(
    path: string,
    opts: { method: string; headers?: Record<string, string>; body?: string; timeoutMs: number },
  ): Promise<Response> {
    const base = this.apiUrl();
    try {
      return await fetch(`${base}${path}`, {
        method: opts.method,
        headers: opts.headers,
        body: opts.body,
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch {
      throw new DeviceCloudHttpError("Device Cloud indisponível no momento.", 502);
    }
  }

  private safeMessage(raw: string, fallback: string): string {
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: string };
      const msg = String(parsed.message || parsed.error || "").trim();
      if (!msg) return fallback;
      if (/secret|token|jwt|hmac|key/i.test(msg)) return fallback;
      return msg.slice(0, 180);
    } catch {
      return fallback;
    }
  }
}

export const wabaDeviceCloudService = new WabaDeviceCloudService();
