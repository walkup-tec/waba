import { randomUUID } from "node:crypto";
import {
  generateWabaCouponAlias,
  isValidWabaCouponAlias,
  normalizeWabaCouponAlias,
} from "./waba-coupon-identifiers";
import {
  WabaCouponRepository,
  type WabaCoupon,
  type WabaCouponValidityMode,
} from "./waba-coupon.repository";

export type CreateWabaCouponInput = {
  alias?: string;
  discountPercent: number;
  validityMode: WabaCouponValidityMode;
  validUntil?: string;
  createdByEmail: string;
  maxRedemptions?: number;
};

export type ValidateWabaCouponInput = {
  alias: string;
  listValueCents: number;
};

export type WabaCouponQuote = {
  couponId: string;
  alias: string;
  discountPercent: number;
  listValueCents: number;
  discountCents: number;
  finalValueCents: number;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const resolveDiscountPercent = (value: number): number => {
  const percent = Math.round(Number(value));
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    throw new Error("Informe um desconto entre 1% e 100%.");
  }
  return percent;
};

const addHours = (iso: string, hours: number): string => {
  const date = new Date(iso);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date.toISOString();
};

const resolveValidityWindow = (
  mode: WabaCouponValidityMode,
  createdAt: string,
  customUntil?: string,
): { validFrom: string; validUntil: string | null } => {
  if (mode === "lifetime") {
    return { validFrom: createdAt, validUntil: null };
  }
  if (mode === "12h") {
    return { validFrom: createdAt, validUntil: addHours(createdAt, 12) };
  }
  if (mode === "24h") {
    return { validFrom: createdAt, validUntil: addHours(createdAt, 24) };
  }
  const until = String(customUntil ?? "").trim();
  if (!until) {
    throw new Error("Informe a data de validade personalizada do cupom.");
  }
  const parsed = new Date(until);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data de validade personalizada inválida.");
  }
  if (parsed.getTime() <= Date.parse(createdAt)) {
    throw new Error("A validade personalizada deve ser posterior ao momento atual.");
  }
  return { validFrom: createdAt, validUntil: parsed.toISOString() };
};

const isCouponCurrentlyValid = (coupon: WabaCoupon, nowMs = Date.now()): boolean => {
  if (!coupon.active) return false;
  const fromMs = Date.parse(coupon.validFrom);
  if (Number.isFinite(fromMs) && nowMs < fromMs) return false;
  if (coupon.validUntil) {
    const untilMs = Date.parse(coupon.validUntil);
    if (Number.isFinite(untilMs) && nowMs > untilMs) return false;
  }
  const max = coupon.maxRedemptions;
  if (max !== undefined && Number.isFinite(max) && max > 0 && coupon.redemptionCount >= max) {
    return false;
  }
  return true;
};

export class WabaCouponService {
  constructor(private readonly repository = new WabaCouponRepository()) {}

  listPublicCoupons() {
    return this.repository
      .list()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((coupon) => this.toPublicCoupon(coupon));
  }

  createCoupon(input: CreateWabaCouponInput) {
    const createdByEmail = normalizeEmail(input.createdByEmail);
    if (!createdByEmail.includes("@")) {
      throw new Error("E-mail do master inválido.");
    }

    const discountPercent = resolveDiscountPercent(input.discountPercent);
    const validityMode = input.validityMode;
    if (!["12h", "24h", "custom", "lifetime"].includes(validityMode)) {
      throw new Error("Selecione uma validade válida para o cupom.");
    }

    const now = new Date().toISOString();
    const { validFrom, validUntil } = resolveValidityWindow(
      validityMode,
      now,
      input.validUntil,
    );

    let alias = normalizeWabaCouponAlias(String(input.alias ?? ""));
    if (!alias) {
      alias = generateWabaCouponAlias();
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (!this.repository.getByAlias(alias)) break;
        alias = generateWabaCouponAlias();
      }
    }
    if (!isValidWabaCouponAlias(alias)) {
      throw new Error('Código inválido. Use o padrão WABA-[caractere especial][4 dígitos].');
    }
    if (this.repository.getByAlias(alias)) {
      throw new Error("Já existe um cupom com este código.");
    }

    const maxRedemptions = Number(input.maxRedemptions ?? 0);
    const coupon = this.repository.create({
      id: randomUUID(),
      alias,
      discountPercent,
      validityMode,
      validFrom,
      validUntil,
      createdByEmail,
      createdAt: now,
      updatedAt: now,
      active: true,
      maxRedemptions: Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? Math.floor(maxRedemptions) : undefined,
      redemptionCount: 0,
    });

    return this.toPublicCoupon(coupon);
  }

  deactivateCoupon(couponId: string) {
    const updated = this.repository.update(couponId, { active: false });
    if (!updated) throw new Error("Cupom não encontrado.");
    return this.toPublicCoupon(updated);
  }

  quoteCoupon(input: ValidateWabaCouponInput): WabaCouponQuote {
    const alias = normalizeWabaCouponAlias(input.alias);
    if (!isValidWabaCouponAlias(alias)) {
      throw new Error('Cupom inválido. Use o padrão WABA-[caractere especial][4 dígitos].');
    }

    const listValueCents = Math.round(Number(input.listValueCents));
    if (!Number.isFinite(listValueCents) || listValueCents <= 0) {
      throw new Error("Valor do pacote inválido para aplicar cupom.");
    }

    const coupon = this.repository.getByAlias(alias);
    if (!coupon) {
      throw new Error("Cupom não encontrado.");
    }
    if (!isCouponCurrentlyValid(coupon)) {
      throw new Error("Cupom expirado, inativo ou esgotado.");
    }

    const discountCents = Math.round((listValueCents * coupon.discountPercent) / 100);
    const finalValueCents = Math.max(1, listValueCents - discountCents);

    return {
      couponId: coupon.id,
      alias: coupon.alias,
      discountPercent: coupon.discountPercent,
      listValueCents,
      discountCents,
      finalValueCents,
    };
  }

  registerRedemption(couponId: string) {
    const coupon = this.repository.getById(couponId);
    if (!coupon) return;
    this.repository.update(coupon.id, {
      redemptionCount: Math.max(0, Math.floor(Number(coupon.redemptionCount) || 0)) + 1,
    });
  }

  private toPublicCoupon(coupon: WabaCoupon) {
    const validNow = isCouponCurrentlyValid(coupon);
    return {
      id: coupon.id,
      alias: coupon.alias,
      discountPercent: coupon.discountPercent,
      validityMode: coupon.validityMode,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil ?? null,
      createdByEmail: coupon.createdByEmail,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      active: coupon.active,
      maxRedemptions: coupon.maxRedemptions ?? null,
      redemptionCount: coupon.redemptionCount,
      validNow,
    };
  }
}
