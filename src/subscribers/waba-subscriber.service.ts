import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { formatBrazilMobileForAsaas, formatBrazilPhoneDigits } from "../billing/phone";
import { notifySubscriberWelcomeEmail } from "../mail/waba-mail-delivery";
import { WabaSubscriberRepository, type WabaSubscriber } from "./waba-subscriber.repository";

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
  aquecedorGranted?: boolean;
};

export type UpdateSubscriberInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  phone?: string;
  cpfCnpj: string;
  aquecedorGranted?: boolean;
  password?: string;
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
    const aquecedorGranted = input.aquecedorGranted === true;
    const subscriber = this.repository.create({
      id: randomUUID(),
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

    const profile = {
      id: subscriber.id,
      email: subscriber.email,
      fullName: subscriber.fullName,
      whatsapp: subscriber.whatsapp,
      phone: subscriber.phone ?? "",
      cpfCnpj: subscriber.cpfCnpj,
      aquecedorGranted: Boolean(subscriber.aquecedorGranted),
      createdAt: subscriber.createdAt,
    };

    notifySubscriberWelcomeEmail({
      email: profile.email,
      fullName: profile.fullName,
      whatsapp: profile.whatsapp,
      phone: profile.phone,
      cpfCnpj: profile.cpfCnpj,
    });

    return profile;
  }

  update(subscriberId: string, input: UpdateSubscriberInput) {
    const id = String(subscriberId ?? "").trim();
    if (!id) throw new Error("Assinante inválido.");
    const existing = this.repository.getById(id);
    if (!existing) throw new Error("Assinante não encontrado.");

    const email = normalizeEmail(input.email);
    const fullName = String(input.fullName ?? "").trim();
    const cpfCnpj = normalizeDigits(String(input.cpfCnpj ?? ""));
    const whatsapp = formatBrazilMobileForAsaas(String(input.whatsapp ?? ""));
    const phoneRaw = String(input.phone ?? "").trim();
    const phone = phoneRaw ? formatBrazilPhoneDigits(phoneRaw) : whatsapp;
    const password = String(input.password ?? "").trim();
    const aquecedorGranted = input.aquecedorGranted === true;

    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
    if (fullName.length < 2) throw new Error("Informe o nome completo.");
    if (cpfCnpj.length < 11) throw new Error("Informe CPF ou CNPJ válido.");
    if (password && password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    const patch: Partial<Omit<WabaSubscriber, "id" | "createdAt">> = {
      email,
      fullName,
      whatsapp,
      phone,
      cpfCnpj,
      aquecedorGranted: aquecedorGranted || undefined,
      updatedAt: new Date().toISOString(),
    };
    if (password) {
      patch.passwordHash = hashPassword(password);
    }

    const subscriber = this.repository.update(id, patch);
    return {
      id: subscriber.id,
      email: subscriber.email,
      fullName: subscriber.fullName,
      whatsapp: subscriber.whatsapp,
      phone: subscriber.phone ?? "",
      cpfCnpj: subscriber.cpfCnpj,
      aquecedorGranted: Boolean(subscriber.aquecedorGranted),
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
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
      cpfCnpj: subscriber.cpfCnpj,
      createdAt: subscriber.createdAt,
    };
  }
}
