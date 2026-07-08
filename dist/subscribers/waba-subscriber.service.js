"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaSubscriberService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_crypto_2 = require("node:crypto");
const phone_1 = require("../billing/phone");
const waba_mail_delivery_1 = require("../mail/waba-mail-delivery");
const waba_app_url_1 = require("../mail/waba-app-url");
const waba_subscriber_segment_1 = require("./waba-subscriber-segment");
const waba_subscriber_repository_1 = require("./waba-subscriber.repository");
const normalizeEmail = (value) => value.trim().toLowerCase();
const normalizeDigits = (value) => value.replace(/\D/g, "");
const hashPassword = (password) => {
    const salt = node_crypto_1.default.randomBytes(16).toString("hex");
    const hash = node_crypto_1.default.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
};
const verifyPassword = (password, stored) => {
    const [salt, hash] = String(stored || "").split(":");
    if (!salt || !hash)
        return false;
    try {
        const expected = Buffer.from(hash, "hex");
        const derived = node_crypto_1.default.scryptSync(password, salt, 64);
        if (expected.length !== derived.length)
            return false;
        return node_crypto_1.default.timingSafeEqual(expected, derived);
    }
    catch {
        return false;
    }
};
class WabaSubscriberService {
    constructor(repository = new waba_subscriber_repository_1.WabaSubscriberRepository()) {
        this.repository = repository;
    }
    toPublicProfile(subscriber) {
        const segment = subscriber.segment ?? "outros";
        return {
            id: subscriber.id,
            email: subscriber.email,
            fullName: subscriber.fullName,
            whatsapp: subscriber.whatsapp,
            phone: subscriber.phone,
            cpfCnpj: subscriber.cpfCnpj,
            aquecedorGranted: Boolean(subscriber.aquecedorGranted),
            segment,
            segmentLabel: waba_subscriber_segment_1.WABA_SUBSCRIBER_SEGMENT_LABELS[segment],
            createdAt: subscriber.createdAt,
            updatedAt: subscriber.updatedAt,
        };
    }
    ensureSubscriberMigrated(subscriber) {
        if (subscriber.segment)
            return subscriber;
        const migrated = this.repository.update(subscriber.id, { segment: "outros" });
        return migrated;
    }
    register(input, options) {
        const email = normalizeEmail(input.email);
        const fullName = String(input.fullName ?? "").trim();
        const password = String(input.password ?? "");
        const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
        const whatsapp = (0, phone_1.resolveSubscriberWhatsAppMobile)(String(input.whatsapp ?? ""), String(input.phone ?? ""));
        const phoneRaw = String(input.phone ?? "").trim();
        const phone = phoneRaw ? (0, phone_1.formatBrazilPhoneDigits)(phoneRaw) : whatsapp;
        if (!email.includes("@"))
            throw new Error("Informe um e-mail válido.");
        if (fullName.length < 2)
            throw new Error("Informe seu nome completo.");
        if (password.length < 6)
            throw new Error("A senha deve ter pelo menos 6 caracteres.");
        if (cpfCnpj.length < 11)
            throw new Error("Informe CPF ou CNPJ válido.");
        const now = new Date().toISOString();
        const aquecedorGranted = input.aquecedorGranted === true;
        const segment = input.segment !== undefined || input.signupOrigin !== undefined
            ? (0, waba_subscriber_segment_1.parseWabaSubscriberSegment)(input.segment ?? input.signupOrigin, { required: true })
            : (0, waba_subscriber_segment_1.resolveSignupSegmentFromRequest)({}, options?.requestHeaders ?? {});
        const subscriber = this.repository.create({
            id: (0, node_crypto_2.randomUUID)(),
            email,
            passwordHash: hashPassword(password),
            fullName,
            whatsapp,
            phone,
            cpfCnpj,
            segment,
            aquecedorGranted: aquecedorGranted || undefined,
            createdAt: now,
            updatedAt: now,
        });
        const profile = this.toPublicProfile(subscriber);
        (0, waba_mail_delivery_1.notifySubscriberWelcomeEmail)({
            email: profile.email,
            fullName: profile.fullName,
            password,
            whatsapp: profile.whatsapp,
            phone: profile.phone,
            cpfCnpj: profile.cpfCnpj,
            loginUrl: (0, waba_app_url_1.resolveWabaAppLoginUrl)(),
        });
        return profile;
    }
    update(subscriberId, input) {
        const id = String(subscriberId ?? "").trim();
        if (!id)
            throw new Error("Assinante inválido.");
        const existing = this.repository.getById(id);
        if (!existing)
            throw new Error("Assinante não encontrado.");
        const email = normalizeEmail(input.email);
        const fullName = String(input.fullName ?? "").trim();
        const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
        const whatsapp = (0, phone_1.resolveSubscriberWhatsAppMobile)(String(input.whatsapp ?? ""), String(input.phone ?? ""));
        const phoneRaw = String(input.phone ?? "").trim();
        const phone = phoneRaw ? (0, phone_1.formatBrazilPhoneDigits)(phoneRaw) : whatsapp;
        const password = String(input.password ?? "").trim();
        const aquecedorGranted = input.aquecedorGranted === true;
        if (!email.includes("@"))
            throw new Error("Informe um e-mail válido.");
        if (fullName.length < 2)
            throw new Error("Informe o nome completo.");
        if (cpfCnpj.length < 11)
            throw new Error("Informe CPF ou CNPJ válido.");
        if (password && password.length < 6) {
            throw new Error("A senha deve ter pelo menos 6 caracteres.");
        }
        const patch = {
            email,
            fullName,
            whatsapp,
            phone,
            cpfCnpj,
            aquecedorGranted: aquecedorGranted || undefined,
            updatedAt: new Date().toISOString(),
        };
        if (input.segment !== undefined) {
            patch.segment = (0, waba_subscriber_segment_1.parseWabaSubscriberSegment)(input.segment, { required: true });
        }
        if (password) {
            patch.passwordHash = hashPassword(password);
        }
        const subscriber = this.repository.update(id, patch);
        return this.toPublicProfile(subscriber);
    }
    validateCredentials(email, password) {
        const subscriber = this.repository.getByEmail(normalizeEmail(email));
        if (!subscriber)
            return false;
        return verifyPassword(String(password ?? ""), subscriber.passwordHash);
    }
    getPublicProfile(email) {
        const subscriber = this.repository.getByEmail(normalizeEmail(email));
        if (!subscriber)
            return null;
        const migrated = this.ensureSubscriberMigrated(subscriber);
        return this.toPublicProfile(migrated);
    }
}
exports.WabaSubscriberService = WabaSubscriberService;
