import type { Express } from "express";
import { BASE_PATH } from "../base-path";
import {
  createWabaSessionToken,
  resolveWabaSessionCookieOptions,
} from "../auth/waba-auth.service";
import { notifySubscriberWelcomeEmail } from "../mail/waba-mail-delivery";
import { resolveWabaAppLoginUrl } from "../mail/waba-app-url";
import { WabaSubscriberService } from "./waba-subscriber.service";

const subscriberService = new WabaSubscriberService();

const resolveAppLoginUrl = (): string => {
  const fromEnv = String(process.env.WABA_APP_LOGIN_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  const base = BASE_PATH || "";
  return `http://localhost:${process.env.PORT || 3012}${base}/`;
};

export const registerWabaSubscriberRoutes = (app: Express) => {
  app.post("/subscribers/register", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const password = String(body.password ?? "");
      const profile = subscriberService.register(
        {
          email: String(body.email ?? ""),
          password,
          fullName: String(body.fullName ?? body.name ?? ""),
          whatsapp: String(body.whatsapp ?? ""),
          phone: String(body.phone ?? ""),
          cpfCnpj: String(body.cpfCnpj ?? ""),
          segment: body.segment,
          signupOrigin: body.signupOrigin ?? body.signupSource,
        },
        {
          requestHeaders: {
            origin: String(req.headers.origin ?? ""),
            referer: String(req.headers.referer ?? ""),
          },
        },
      );
      const loginUrl = resolveAppLoginUrl();
      // Não bloquear o HTTP no e-mail/WhatsApp — timeout de SMTP/WA causa "Failed to fetch" no browser.
      notifySubscriberWelcomeEmail({
        email: profile.email,
        fullName: profile.fullName,
        password,
        whatsapp: profile.whatsapp,
        phone: profile.phone,
        cpfCnpj: profile.cpfCnpj,
        loginUrl,
      });
      return res.status(201).json({
        ok: true,
        subscriber: profile,
        loginUrl,
        message:
          "Cadastro realizado. Você receberá e-mail e WhatsApp de boas-vindas. Faça login no painel WABA.",
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível concluir o cadastro.",
      });
    }
  });

  app.post("/subscribers/login", (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const email = String(body.email ?? "");
      const password = String(body.password ?? "");
      if (!subscriberService.validateCredentials(email, password)) {
        return res.status(401).json({ error: "E-mail ou senha inválidos." });
      }

      const token = createWabaSessionToken(email, "subscriber");
      const cookie = resolveWabaSessionCookieOptions(BASE_PATH);
      const cookieParts = [
        `${cookie.name}=${encodeURIComponent(token)}`,
        `Path=${cookie.path}`,
        `Max-Age=${cookie.maxAge}`,
        "HttpOnly",
        `SameSite=${cookie.sameSite}`,
      ];
      if (cookie.secure) cookieParts.push("Secure");
      res.setHeader("Set-Cookie", cookieParts.join("; "));

      const profile = subscriberService.getPublicProfile(email);
      return res.status(200).json({
        ok: true,
        email: profile?.email ?? email.trim().toLowerCase(),
        role: "subscriber",
        subscriber: profile,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Não foi possível entrar.",
      });
    }
  });
};
