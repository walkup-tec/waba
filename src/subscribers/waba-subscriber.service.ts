import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { formatBrazilMobileForAsaas, formatBrazilPhoneDigits } from "../billing/phone";
import { WabaSubscriberRepository } from "./waba-subscriber.repository";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const derived = crypto.scryptSync(password, salt, 64);
    if (expected.length !== derived.length) return false;
    return crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
};

export type RegisterSubscriberInput = {
  email: string;
  password: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
};

export class WabaSubscriberService {
  constructor(private readonly repository = new WabaSubscriberRepository()) {}

  register(input: RegisterSubscriberInput) {
    const email = normalizeEmail(input.email);
    const fullName = String(input.fullName ?? "").trim();
    const password = String(input.password ?? "");
    const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
    const whatsapp = formatBrazilMobileForAsaas(String(input.whatsapp ?? ""));
    const phoneRaw = String(input.phone ?? "").trim();
    const phone = phoneRaw ? formatBrazilPhoneDigits(phoneRaw) : whatsapp;

    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
    if (fullName.length < 2) throw new Error("Informe seu nome completo.");
    if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
    if (cpfCnpj.length < 11) throw new Error("Informe CPF ou CNPJ válido.");

    const now = new Date().toISOString();
    const subscriber = this.repository.create({
      id: randomUUID(),
      email,
      passwordHash: hashPassword(password),
      fullName,
      whatsapp,
      phone,
      cpfCnpj,
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
      createdAt: subscriber.createdAt,
    };
  }

  validateCredentials(email: string, password: string): boolean {
    const subscriber = this.repository.getByEmail(normalizeEmail(email));
    if (!subscriber) return false;
    return verifyPassword(String(password ?? ""), subscriber.passwordHash);
  }

  getPublicProfile(email: string) {
    const subscriber = this.repository.getByEmail(normalizeEmail(email));
    if (!subscriber) return null;
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
