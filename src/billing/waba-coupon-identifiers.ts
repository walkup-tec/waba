import crypto from "node:crypto";

/** Caracteres especiais permitidos após o prefixo WABA- */
export const WABA_COUPON_SPECIAL_CHARS = "#$%&*!@?" as const;

export const WABA_COUPON_ALIAS_REGEX = /^WABA-[#$%&*!@?][0-9]{4}$/;

export const normalizeWabaCouponAlias = (value: string): string =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

export const isValidWabaCouponAlias = (value: string): boolean =>
  WABA_COUPON_ALIAS_REGEX.test(normalizeWabaCouponAlias(value));

export const generateWabaCouponAlias = (): string => {
  const pool = WABA_COUPON_SPECIAL_CHARS;
  const special = pool[crypto.randomInt(0, pool.length)] ?? "#";
  const digits = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  return `WABA-${special}${digits}`;
};
