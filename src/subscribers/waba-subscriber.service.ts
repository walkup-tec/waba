import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { formatBrazilMobileForAsaas, formatBrazilPhoneDigits } from "../billing/phone";
import { notifySubscriberWelcomeEmail } from "../mail/waba-mail-delivery";
import {
  parseWabaSubscriberSegment,
  resolveSignupSegmentFromRequest,
  WABA_SUBSCRIBER_SEGMENT_LABELS,
  type WabaSubscriberSegment,
} from "./waba-subscriber-segment";
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
  segment?: unknown;
  signupOrigin?: unknown;
};

export type UpdateSubscriberInput = {
  fullName: string;
  email: string;
  whatsapp: string;
  phone?: string;
  cpfCnpj: string;
  aquecedorGranted?: boolean;
  password?: string;
  segment?: unknown;
};

export type PublicSubscriberProfile = {
  id: string;
  email: string;
  fullName: string;
  whatsapp: string;
  phone: string;
  cpfCnpj: string;
  aquecedorGranted: boolean;
  segment: WabaSubscriberSegment;
  segmentLabel: string;
  createdAt: string;
  updatedAt?: string;
};

export class WabaSubscriberService {
  constructor(private readonly repository = new WabaSubscriberRepository()) {}

  private toPublicProfile(subscriber: WabaSubscriber): PublicSubscriberProfile {
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
      segmentLabel: WABA_SUBSCRIBER_SEGMENT_LABELS[segment],
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
    };
  }

  private ensureSubscriberMigrated(subscriber: WabaSubscriber): WabaSubscriber {
    if (subscriber.segment) return subscriber;
    const migrated = this.repository.update(subscriber.id, { segment: "outros" });
    return migrated;
  }

  register(input: RegisterSubscriberInput, options?: { requestHeaders?: { origin?: string; referer?: string } }) {
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
    const segment =
      input.segment !== undefined || input.signupOrigin !== undefined
        ? parseWabaSubscriberSegment(input.segment ?? input.signupOrigin, { required: true })
        : resolveSignupSegmentFromRequest({}, options?.requestHeaders ?? {});
    const subscriber = this.repository.create({
      id: randomUUID(),
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

    notifySubscriberWelcomeEmail({
      email: profile.email,
      fullName: profile.fullName,
      password,
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
    if (input.segment !== undefined) {
      patch.segment = parseWabaSubscriberSegment(input.segment, { required: true });
    }
    if (password) {
      patch.passwordHash = hashPassword(password);
    }

    const subscriber = this.repository.update(id, patch);
    return this.toPublicProfile(subscriber);
  }

  validateCredentials(email: string, password: string): boolean {
    const subscriber = this.repository.getByEmail(normalizeEmail(email));
    if (!subscriber) return false;
    return verifyPassword(String(password ?? ""), subscriber.passwordHash);
  }

  getPublicProfile(email: string): PublicSubscriberProfile | null {
    const subscriber = this.repository.getByEmail(normalizeEmail(email));
    if (!subscriber) return null;
    const migrated = this.ensureSubscriberMigrated(subscriber);
    return this.toPublicProfile(migrated);
  }
}
