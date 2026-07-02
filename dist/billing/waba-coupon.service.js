"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCouponService = exports.parseWabaCouponDiscountPercent = void 0;
const node_crypto_1 = require("node:crypto");
const waba_coupon_identifiers_1 = require("./waba-coupon-identifiers");
const waba_coupon_repository_1 = require("./waba-coupon.repository");
const normalizeEmail = (value) => value.trim().toLowerCase();
const parseWabaCouponDiscountPercent = (value) => {
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("Informe um desconto entre 0,01% e 100,00%.");
        }
        return normalizeWabaCouponDiscountPercent(value);
    }
    const raw = String(value ?? "").trim();
    if (!raw) {
        throw new Error("Informe o desconto (%) do cupom.");
    }
    let normalized = raw.replace(/\s/g, "");
    if (normalized.includes(",")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        throw new Error("Informe um desconto válido (ex.: 10,00).");
    }
    return normalizeWabaCouponDiscountPercent(parsed);
};
exports.parseWabaCouponDiscountPercent = parseWabaCouponDiscountPercent;
const normalizeWabaCouponDiscountPercent = (parsed) => {
    const percent = Math.round(parsed * 100) / 100;
    if (!Number.isFinite(percent) || percent < 0.01 || percent > 100) {
        throw new Error("Informe um desconto entre 0,01% e 100,00%.");
    }
    return percent;
};
const resolveDiscountPercent = (value) => (0, exports.parseWabaCouponDiscountPercent)(value);
const addHours = (iso, hours) => {
    const date = new Date(iso);
    date.setTime(date.getTime() + hours * 60 * 60 * 1000);
    return date.toISOString();
};
const resolveValidityWindow = (mode, createdAt, customUntil) => {
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
    const minUntilMs = Date.now() + 60000;
    if (parsed.getTime() < minUntilMs) {
        throw new Error("A validade personalizada deve ser pelo menos 1 minuto no futuro.");
    }
    return { validFrom: createdAt, validUntil: parsed.toISOString() };
};
const isCouponCurrentlyValid = (coupon, nowMs = Date.now()) => {
    if (!coupon.active)
        return false;
    const fromMs = Date.parse(coupon.validFrom);
    if (Number.isFinite(fromMs) && nowMs < fromMs)
        return false;
    if (coupon.validUntil) {
        const untilMs = Date.parse(coupon.validUntil);
        if (Number.isFinite(untilMs) && nowMs > untilMs)
            return false;
    }
    const max = coupon.maxRedemptions;
    if (max !== undefined && Number.isFinite(max) && max > 0 && coupon.redemptionCount >= max) {
        return false;
    }
    return true;
};
class WabaCouponService {
    constructor(repository = new waba_coupon_repository_1.WabaCouponRepository()) {
        this.repository = repository;
    }
    listPublicCoupons() {
        return this.repository
            .list()
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .map((coupon) => this.toPublicCoupon(coupon));
    }
    createCoupon(input) {
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
        const { validFrom, validUntil } = resolveValidityWindow(validityMode, now, input.validUntil);
        let alias = (0, waba_coupon_identifiers_1.normalizeWabaCouponAlias)(String(input.alias ?? ""));
        if (!alias) {
            alias = (0, waba_coupon_identifiers_1.generateWabaCouponAlias)();
            for (let attempt = 0; attempt < 12; attempt += 1) {
                if (!this.repository.getByAlias(alias))
                    break;
                alias = (0, waba_coupon_identifiers_1.generateWabaCouponAlias)();
            }
        }
        if (!(0, waba_coupon_identifiers_1.isValidWabaCouponAlias)(alias)) {
            throw new Error('Código inválido. Use o padrão WABA-[caractere especial][4 dígitos].');
        }
        if (this.repository.getByAlias(alias)) {
            throw new Error("Já existe um cupom com este código.");
        }
        const maxRedemptions = Number(input.maxRedemptions ?? 0);
        const coupon = this.repository.create({
            id: (0, node_crypto_1.randomUUID)(),
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
    deactivateCoupon(couponId) {
        const updated = this.repository.update(couponId, { active: false });
        if (!updated)
            throw new Error("Cupom não encontrado.");
        return this.toPublicCoupon(updated);
    }
    quoteCoupon(input) {
        const alias = (0, waba_coupon_identifiers_1.normalizeWabaCouponAlias)(input.alias);
        if (!(0, waba_coupon_identifiers_1.isValidWabaCouponAlias)(alias)) {
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
    registerRedemption(couponId) {
        const coupon = this.repository.getById(couponId);
        if (!coupon)
            return;
        this.repository.update(coupon.id, {
            redemptionCount: Math.max(0, Math.floor(Number(coupon.redemptionCount) || 0)) + 1,
        });
    }
    toPublicCoupon(coupon) {
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
exports.WabaCouponService = WabaCouponService;
