"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaSubscriberService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_crypto_2 = require("node:crypto");
const phone_1 = require("../billing/phone");
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
    register(input) {
        const email = normalizeEmail(input.email);
        const fullName = String(input.fullName ?? "").trim();
        const password = String(input.password ?? "");
        const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
        const whatsapp = (0, phone_1.formatBrazilMobileForAsaas)(String(input.whatsapp ?? ""));
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
        const subscriber = this.repository.create({
            id: (0, node_crypto_2.randomUUID)(),
            email,
            passwordHash: hashPassword(password),
            fullName,
            whatsapp,
            phone,
            cpfCnpj,
            aquecedorGranted: aquecedorGranted || undefined,
            createdAt: now,
            updatedAt: now,
        });
        return {
            id: subscriber.id,
            email: subscriber.email,
            fullName: subscriber.fullName,
            whatsapp: subscriber.whatsapp,
            phone: subscriber.phone ?? "",
            cpfCnpj: subscriber.cpfCnpj,
            aquecedorGranted: Boolean(subscriber.aquecedorGranted),
            createdAt: subscriber.createdAt,
        };
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
        return {
            id: subscriber.id,
            email: subscriber.email,
            fullName: subscriber.fullName,
            whatsapp: subscriber.whatsapp,
            phone: subscriber.phone,
            createdAt: subscriber.createdAt,
        };
    }
}
exports.WabaSubscriberService = WabaSubscriberService;
