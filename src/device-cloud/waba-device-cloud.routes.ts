import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { resolveWabaRequestAuth } from "../auth/waba-request-auth";

const DEVICE_CLOUD_ALLOWLIST = new Set(["mozart.pmo@gmail.com"]);

export function isDeviceCloudEmailAllowed(email: string): boolean {
  return DEVICE_CLOUD_ALLOWLIST.has(String(email || "").trim().toLowerCase());
}

function resolveDeviceCloudWebUrl(): string {
  const web = String(process.env.DEVICE_CLOUD_WEB_URL || "").trim().replace(/\/$/, "");
  if (web) return web;
  const publicUrl = String(process.env.DEVICE_CLOUD_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (publicUrl.includes("://api-devices.draxsistemas.com.br")) {
    return "https://devices.draxsistemas.com.br";
  }
  return publicUrl;
}

/** Compact SSO token: base64url(json).base64url(hmac-sha256) */
export function signDeviceCloudSsoToken(
  claims: Record<string, unknown>,
  secret: string,
  expiresInSec = 300,
): string {
  const payload = {
    ...claims,
    aud: "drax-device-cloud",
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
    iat: Math.floor(Date.now() / 1000),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function registerDeviceCloudRoutes(app: Express): void {
  app.post("/device-cloud/sso", (req: Request, res: Response) => {
    const profile = String(process.env.WABA_UI_PROFILE || "").trim().toLowerCase();
    if (profile !== "production") {
      return res.status(403).json({
        error: "Device Cloud disponível apenas no perfil production.",
      });
    }

    const auth = resolveWabaRequestAuth(req);
    const email = String(auth.email || "").trim().toLowerCase();
    if (!email || !isDeviceCloudEmailAllowed(email)) {
      return res.status(403).json({ error: "Conta não autorizada para Device Cloud." });
    }

    const secret = String(process.env.DEVICE_CLOUD_SSO_SECRET || "").trim();
    const publicUrl = resolveDeviceCloudWebUrl();
    if (!secret || !publicUrl) {
      return res.status(503).json({
        error:
          "DEVICE_CLOUD_SSO_SECRET / DEVICE_CLOUD_PUBLIC_URL não configurados no ambiente.",
      });
    }

    const ssoToken = signDeviceCloudSsoToken(
      {
        sub: email,
        email,
        tenant: process.env.DEVICE_CLOUD_DEFAULT_TENANT_ID || "00000000-0000-4000-8000-000000000001",
        userId: process.env.DEVICE_CLOUD_DEFAULT_USER_ID || "00000000-0000-4000-8000-000000000011",
        role: "admin",
      },
      secret,
      300,
    );

    const url = `${publicUrl}/?sso=${encodeURIComponent(ssoToken)}`;
    return res.json({
      ok: true,
      url,
      expiresInSec: 300,
    });
  });
}
