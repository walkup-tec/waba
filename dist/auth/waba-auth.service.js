"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWabaSessionCookie = exports.resolveWabaSessionCookieOptions = exports.validateWabaAdminCredentials = exports.verifyWabaSessionToken = exports.resolveSessionRole = exports.isWabaMasterEmail = exports.createWabaSessionToken = exports.getWabaAuthPublicConfig = exports.isWabaAuthConfigured = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const waba_system_user_repository_1 = require("../users/waba-system-user.repository");
const systemUserRepository = new waba_system_user_repository_1.WabaSystemUserRepository();
const SESSION_COOKIE = "waba_session";
const DEFAULT_SESSION_TTL_HOURS = 168;
const normalizeEmail = (value) => value.trim().toLowerCase();
const resolveAdminEmail = () => normalizeEmail(String(process.env.WABA_ADMIN_EMAIL ?? ""));
const resolveAdminPassword = () => String(process.env.WABA_ADMIN_PASSWORD ?? "");
const resolveSessionSecret = () => {
    const fromEnv = String(process.env.WABA_SESSION_SECRET ?? "").trim();
    if (fromEnv.length >= 16)
        return fromEnv;
    return node_crypto_1.default.createHash("sha256").update(`waba-dev-${resolveAdminEmail()}`).digest("hex");
};
const resolveSessionTtlMs = () => {
    const hours = Number(process.env.WABA_SESSION_TTL_HOURS ?? DEFAULT_SESSION_TTL_HOURS);
    if (!Number.isFinite(hours) || hours <= 0)
        return DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000;
    return Math.round(hours * 60 * 60 * 1000);
};
const isWabaAuthConfigured = () => resolveAdminEmail().includes("@") && resolveAdminPassword().length >= 6;
exports.isWabaAuthConfigured = isWabaAuthConfigured;
const getWabaAuthPublicConfig = () => ({
    authConfigured: (0, exports.isWabaAuthConfigured)(),
    sessionCookieName: SESSION_COOKIE,
});
exports.getWabaAuthPublicConfig = getWabaAuthPublicConfig;
const signPayload = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = node_crypto_1.default.createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
};
const readSessionToken = (token) => {
    const normalized = String(token ?? "").trim();
    const dot = normalized.lastIndexOf(".");
    if (dot <= 0)
        return null;
    const body = normalized.slice(0, dot);
    const sig = normalized.slice(dot + 1);
    const expected = node_crypto_1.default.createHmac("sha256", resolveSessionSecret()).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !node_crypto_1.default.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (!payload?.email || !Number.isFinite(payload.exp) || payload.exp < Date.now()) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
};
const createWabaSessionToken = (email, role = "subscriber") => {
    const payload = {
        email: normalizeEmail(email),
        exp: Date.now() + resolveSessionTtlMs(),
        role,
    };
    return signPayload(payload);
};
exports.createWabaSessionToken = createWabaSessionToken;
const isWabaMasterEmail = (email) => {
    const adminEmail = resolveAdminEmail();
    if (!adminEmail.includes("@"))
        return false;
    return normalizeEmail(email) === adminEmail;
};
exports.isWabaMasterEmail = isWabaMasterEmail;
/** Papel efetivo: usuários do sistema → master/operacional/suporte; senão assinante. */
const resolveSessionRole = (payload) => {
    if (!payload?.email)
        return "subscriber";
    const storedRole = systemUserRepository.getRoleByEmail(payload.email);
    if (storedRole)
        return storedRole;
    if ((0, exports.isWabaMasterEmail)(payload.email))
        return "master";
    return "subscriber";
};
exports.resolveSessionRole = resolveSessionRole;
const verifyWabaSessionToken = (token) => {
    if (!token)
        return null;
    return readSessionToken(token);
};
exports.verifyWabaSessionToken = verifyWabaSessionToken;
const validateWabaAdminCredentials = (email, password) => {
    if (!(0, exports.isWabaAuthConfigured)())
        return false;
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
    return (node_crypto_1.default.timingSafeEqual(emailBuf, expectedEmailBuf) &&
        node_crypto_1.default.timingSafeEqual(passBuf, expectedPassBuf));
};
exports.validateWabaAdminCredentials = validateWabaAdminCredentials;
const resolveWabaSessionCookieOptions = (basePath) => {
    const path = basePath && basePath !== "/" ? basePath : "/";
    const maxAge = Math.floor(resolveSessionTtlMs() / 1000);
    const secure = String(process.env.WABA_SESSION_COOKIE_SECURE ?? "").trim() === "true";
    return {
        name: SESSION_COOKIE,
        httpOnly: true,
        sameSite: "lax",
        secure,
        path,
        maxAge,
    };
};
exports.resolveWabaSessionCookieOptions = resolveWabaSessionCookieOptions;
const readWabaSessionCookie = (cookieHeader) => {
    const raw = String(cookieHeader ?? "");
    const name = SESSION_COOKIE;
    const parts = raw.split(";").map((part) => part.trim());
    for (const part of parts) {
        if (!part.startsWith(`${name}=`))
            continue;
        return decodeURIComponent(part.slice(name.length + 1));
    }
    return "";
};
exports.readWabaSessionCookie = readWabaSessionCookie;
