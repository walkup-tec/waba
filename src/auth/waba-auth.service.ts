import crypto from "node:crypto";
import { WabaSystemUserRepository } from "../users/waba-system-user.repository";

const systemUserRepository = new WabaSystemUserRepository();

const SESSION_COOKIE = "waba_session";
const DEFAULT_SESSION_TTL_HOURS = 168;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const resolveAdminEmail = (): string => normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));

const resolveAdminPassword = (): string => String(process.env.WABA_ADMIN_PASSWORD ?? "");

const resolveSessionSecret = (): string => {
  const fromEnv = String(process.env.WABA_SESSION_SECRET ?? "").trim();
  if (fromEnv.length >= 16) return fromEnv;
  return crypto.createHash("sha256").update(`waba-dev-${resolveAdminEmail()}`).digest("hex");
};

const resolveSessionTtlMs = (): number => {
  const hours = Number(process.env.WABA_SESSION_TTL_HOURS ?? DEFAULT_SESSION_TTL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  return Math.round(hours * 60 * 60 * 1000);
};

export const isWabaAuthConfigured = (): boolean =>
  resolveAdminEmail().includes("@") && resolveAdminPassword().length >= 6;

export const getWabaAuthPublicConfig = () => ({
  authConfigured: isWabaAuthConfigured(),
  sessionCookieName: SESSION_COOKIE,
});

export type WabaSessionRole = "master" | "operacional" | "suporte" | "subscriber";

type SessionPayload = {
  email: string;
  exp: number;
  role?: WabaSessionRole;
  epoch?: string;
};

const resolveSessionEpoch = (): string => {
  const fromEnv = String(process.env.WABA_SESSION_EPOCH ?? "").trim();
  if (fromEnv) return fromEnv;
  return "1";
};

const signPayload = (payload: SessionPayload): string => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
};

const readSessionToken = (token: string): SessionPayload | null => {
  const normalized = String(token ?? "").trim();
  const dot = normalized.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = normalized.slice(0, dot);
  const sig = normalized.slice(dot + 1);
  const expected = crypto.createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.email || !Number.isFinite(payload.exp) || payload.exp < Date.now()) {
      return null;
    }
    const tokenEpoch = String(payload.epoch ?? "1").trim() || "1";
    if (tokenEpoch !== resolveSessionEpoch()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const createWabaSessionToken = (
  email: string,
  role: WabaSessionRole = "subscriber",
): string => {
  const payload: SessionPayload = {
    email: normalizeEmail(email),
    exp: Date.now() + resolveSessionTtlMs(),
    role,
    epoch: resolveSessionEpoch(),
  };
  return signPayload(payload);
};

export const isWabaMasterEmail = (email: string): boolean => {
  const adminEmail = resolveAdminEmail();
  if (!adminEmail.includes("@")) return false;
  return normalizeEmail(email) === adminEmail;
};

/** Papel efetivo: usuários do sistema → master/operacional/suporte; senão assinante. */
export const resolveSessionRole = (payload: SessionPayload | null): WabaSessionRole => {
  if (!payload?.email) return "subscriber";
  const storedRole = systemUserRepository.getRoleByEmail(payload.email);
  if (storedRole) return storedRole;
  if (isWabaMasterEmail(payload.email)) return "master";
  return "subscriber";
};

export const verifyWabaSessionToken = (token: string | undefined): SessionPayload | null => {
  if (!token) return null;
  return readSessionToken(token);
};

export const validateWabaAdminCredentials = (email: string, password: string): boolean => {
  if (!isWabaAuthConfigured()) return false;

  const expectedEmail = resolveAdminEmail();
  const expectedPassword = resolveAdminPassword();
  const givenEmail = normalizeEmail(email);
  const givenPassword = String(password ?? "");

  const emailBuf = Buffer.from(givenEmail);
  const expectedEmailBuf = Buffer.from(expectedEmail);
  const passBuf = Buffer.from(givenPassword);
  const expectedPassBuf = Buffer.from(expectedPassword);

  if (emailBuf.length !== expectedEmailBuf.length || passBuf.length !== expectedPassBuf.length) {
    return false;
  }

  return (
    crypto.timingSafeEqual(emailBuf, expectedEmailBuf) &&
    crypto.timingSafeEqual(passBuf, expectedPassBuf)
  );
};

export const resolveWabaSessionCookieOptions = (basePath: string) => {
  const path = basePath && basePath !== "/" ? basePath : "/";
  const maxAge = Math.floor(resolveSessionTtlMs() / 1000);
  const secure = String(process.env.WABA_SESSION_COOKIE_SECURE ?? "").trim() === "true";
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path,
    maxAge,
  };
};

export const readWabaSessionCookie = (cookieHeader: string | undefined): string => {
  const raw = String(cookieHeader ?? "");
  const name = SESSION_COOKIE;
  const parts = raw.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return "";
};
