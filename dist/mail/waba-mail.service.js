"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaMailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = require("dotenv");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let didEnsureEnv = false;
const ensureEnvLoaded = () => {
    if (didEnsureEnv)
        return;
    didEnsureEnv = true;
    (0, dotenv_1.config)();
    if (!process.env.SMTP_HOST) {
        const rootEnv = (0, node_path_1.resolve)(process.cwd(), ".env");
        if ((0, node_fs_1.existsSync)(rootEnv)) {
            (0, dotenv_1.config)({ path: rootEnv, override: false });
        }
    }
};
const readConfig = () => {
    ensureEnvLoaded();
    const host = String(process.env.SMTP_HOST ?? "").trim();
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure = String(process.env.SMTP_SECURE ?? "true")
        .trim()
        .toLowerCase() === "true";
    const user = String(process.env.SMTP_USER ?? "").trim();
    const pass = String(process.env.SMTP_PASS ?? "").trim();
    const from = String(process.env.MAIL_FROM ?? user).trim();
    const mode = String(process.env.MAIL_MODE ?? "smtp")
        .trim()
        .toLowerCase();
    return { host, port, secure, user, pass, from, mode };
};
const isSmtpConfigured = (cfg) => Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from && cfg.mode === "smtp");
const buildTextFromHtml = (html) => html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .trim();
exports.wabaMailService = {
    isConfigured() {
        return isSmtpConfigured(readConfig());
    },
    async send(payload) {
        const cfg = readConfig();
        if (!isSmtpConfigured(cfg)) {
            throw new Error("Serviço de e-mail não configurado (MAIL_MODE=smtp e SMTP_*).");
        }
        const transporter = nodemailer_1.default.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: {
                user: cfg.user,
                pass: cfg.pass,
            },
        });
        const info = await transporter.sendMail({
            from: cfg.from,
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text?.trim() || buildTextFromHtml(payload.html),
        });
        return {
            messageId: String(info.messageId ?? ""),
            accepted: Array.isArray(info.accepted) ? info.accepted.map((item) => String(item)) : [],
            rejected: Array.isArray(info.rejected) ? info.rejected.map((item) => String(item)) : [],
            response: String(info.response ?? ""),
        };
    },
};
