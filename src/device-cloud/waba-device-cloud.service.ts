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

/** Devices do SaaS (devices.draxsistemas.com.br) não entram na aba Dispositivos do WABA. */
export const DEVICE_CLOUD_WABA_NAME_PREFIX = "WABA · ";
const DEVICE_CLOUD_SAAS_NAME_PREFIXES = ["SAAS · ", "DRAX-DEVICES · "];

export function isSaasPublishedDeviceCloudName(name: string): boolean {
  const label = String(name || "").trim();
  return DEVICE_CLOUD_SAAS_NAME_PREFIXES.some((prefix) => label.toUpperCase().startsWith(prefix.toUpperCase()));
}

export function withWabaDeviceCloudName(name?: string): string {
  const base =
    String(name || "").trim() || `Android ${new Date().toISOString().slice(11, 16).replace(":", "")}`;
  if (base.toUpperCase().startsWith(DEVICE_CLOUD_WABA_NAME_PREFIX.toUpperCase())) {
    return base.slice(0, 48);
  }
  return `${DEVICE_CLOUD_WABA_NAME_PREFIX}${base}`.slice(0, 48);
}

export function isDeviceVisibleOnWaba(device: DeviceCloudDevice): boolean {
  return Boolean(device?.id) && !isSaasPublishedDeviceCloudName(String(device.name || ""));
}

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

  bootstrap(email: string): { apiUrl: string; ssoToken: string; expiresInSec: number } {
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

  async listDevicesForUser(email: string): Promise<DeviceCloudDevice[]> {
    const token = await this.accessToken(email);
    return (await this.listDevices(token)).filter(isDeviceVisibleOnWaba);
  }

  async createNewDevice(email: string, name?: string): Promise<DeviceCloudDevice> {
    const token = await this.accessToken(email);
    const label = withWabaDeviceCloudName(name);
    const created = await this.createDevice(token, label.slice(0, 48));
    const createdStatus = String(created.status || "").toUpperCase();
    if (created.id && createdStatus !== "ERROR") return created;
    const retry = await this.listDevices(token);
    const match = retry.find((d) => d.id === created.id) || retry[retry.length - 1];
    if (match?.id) return match;
    throw new DeviceCloudHttpError("Não foi possível criar o dispositivo.", 502);
  }

  async ensureDevice(email: string): Promise<DeviceCloudDevice> {
    const token = await this.accessToken(email);
    const existing = (await this.listDevices(token)).filter(isDeviceVisibleOnWaba);
    const online = existing.find((d) => String(d.status || "").toUpperCase() === "ONLINE");
    if (online?.id) return online;
    const ready = existing.find((d) => {
      const status = String(d.status || "").toUpperCase();
      return Boolean(d.id) && status !== "ERROR";
    });
    if (ready?.id) return ready;
    if (existing.length > 0) {
      throw new DeviceCloudHttpError(
        "O celular virtual não está pronto. Tente de novo em alguns segundos.",
        502,
      );
    }
    const created = await this.createDevice(token, withWabaDeviceCloudName("Android"));
    const createdStatus = String(created.status || "").toUpperCase();
    if (created.id && createdStatus !== "ERROR") return created;
    const retry = await this.listDevices(token);
    const retryOnline = retry.find((d) => String(d.status || "").toUpperCase() === "ONLINE");
    if (retryOnline?.id) return retryOnline;
    throw new DeviceCloudHttpError("Não foi possível criar o dispositivo.", 502);
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

  async launchWhatsAppBusiness(email: string, deviceId: string): Promise<void> {
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

  async restartDevice(email: string, deviceId: string): Promise<void> {
    this.assertDeviceId(deviceId);
    const token = await this.accessToken(email);
    const res = await this.apiFetch(`/devices/${deviceId}/restart`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: "{}",
      timeoutMs: 120000,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new DeviceCloudHttpError(this.safeMessage(raw, "Não foi possível reiniciar o celular."), res.status);
    }
  }

  async pushDownloadFile(
    email: string,
    deviceId: string,
    body: { filename: string; contentBase64?: string; buffer?: Buffer },
  ): Promise<{ remotePath: string }> {
    this.assertDeviceId(deviceId);
    const filename = String(body.filename || "")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 80);
    const fromBuffer = body.buffer && body.buffer.length ? body.buffer : null;
    const contentBase64 = String(body.contentBase64 || "").trim();
    const payloadBase64 = fromBuffer ? fromBuffer.toString("base64") : contentBase64;
    if (!filename || !payloadBase64 || payloadBase64.length > 8_000_000) {
      throw new DeviceCloudHttpError("Arquivo inválido ou grande demais.", 400);
    }
    const token = await this.accessToken(email);
    const remotePath = `/sdcard/Download/${filename}`;
    const res = await this.apiFetch(`/devices/${deviceId}/push-file`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ remotePath, contentBase64: payloadBase64 }),
      timeoutMs: 60000,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      if (res.status === 404) {
        throw new DeviceCloudHttpError(
          "Envio de imagem ao celular ainda não está disponível no Device Cloud (endpoint push-file).",
          501,
        );
      }
      throw new DeviceCloudHttpError(this.safeMessage(raw, "Não foi possível enviar a imagem ao celular."), res.status);
    }
    return { remotePath };
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
    const payload = (await res.json().catch(() => null)) as {
      accessToken?: string;
      message?: string;
      error?: string;
    } | null;
    if (!res.ok || !payload?.accessToken) {
      if (res.status === 401) {
        throw new DeviceCloudHttpError(
          "Acesso ao Device Cloud recusado. Confira DEVICE_CLOUD_SSO_SECRET no EasyPanel (igual ao worker AWS).",
          502,
        );
      }
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
      body: JSON.stringify({ name, origin: "waba", product: "waba" }),
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
      product: "waba",
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
