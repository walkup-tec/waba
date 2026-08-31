"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWabaCouponAlias = exports.isValidWabaCouponAlias = exports.normalizeWabaCouponAlias = exports.WABA_COUPON_ALIAS_REGEX = exports.WABA_COUPON_SPECIAL_CHARS = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
/** Caracteres especiais permitidos após o prefixo WABA- */
exports.WABA_COUPON_SPECIAL_CHARS = "#$%&*!@?";
exports.WABA_COUPON_ALIAS_REGEX = /^WABA-[#$%&*!@?][0-9]{4}$/;
const normalizeWabaCouponAlias = (value) => String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
exports.normalizeWabaCouponAlias = normalizeWabaCouponAlias;
const isValidWabaCouponAlias = (value) => exports.WABA_COUPON_ALIAS_REGEX.test((0, exports.normalizeWabaCouponAlias)(value));
exports.isValidWabaCouponAlias = isValidWabaCouponAlias;
const generateWabaCouponAlias = () => {
    const pool = exports.WABA_COUPON_SPECIAL_CHARS;
    const special = pool[node_crypto_1.default.randomInt(0, pool.length)] ?? "#";
    const digits = String(node_crypto_1.default.randomInt(0, 10000)).padStart(4, "0");
    return `WABA-${special}${digits}`;
};
exports.generateWabaCouponAlias = generateWabaCouponAlias;
