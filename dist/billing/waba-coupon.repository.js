"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaCouponRepository = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const data_path_1 = require("../data-path");
const waba_coupon_identifiers_1 = require("./waba-coupon-identifiers");
const COUPONS_FILE = (0, data_path_1.resolveDataFile)("waba-coupons.json");
const ensureStorage = () => {
    const folder = (0, node_path_1.dirname)(COUPONS_FILE);
    if (!(0, node_fs_1.existsSync)(folder))
        (0, node_fs_1.mkdirSync)(folder, { recursive: true });
    if (!(0, node_fs_1.existsSync)(COUPONS_FILE)) {
        (0, node_fs_1.writeFileSync)(COUPONS_FILE, "[]", "utf-8");
    }
};
const loadCoupons = () => {
    ensureStorage();
    try {
        const raw = (0, node_fs_1.readFileSync)(COUPONS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const saveCoupons = (coupons) => {
    ensureStorage();
    (0, node_fs_1.writeFileSync)(COUPONS_FILE, JSON.stringify(coupons, null, 2), "utf-8");
};
class WabaCouponRepository {
    list() {
        return loadCoupons();
    }
    getById(id) {
        const normalized = String(id ?? "").trim();
        if (!normalized)
            return null;
        return loadCoupons().find((coupon) => coupon.id === normalized) ?? null;
    }
    getByAlias(alias) {
        const normalized = (0, waba_coupon_identifiers_1.normalizeWabaCouponAlias)(alias);
        if (!normalized)
            return null;
        return loadCoupons().find((coupon) => coupon.alias === normalized) ?? null;
    }
    create(coupon) {
        const coupons = loadCoupons();
        if (coupons.some((item) => item.alias === coupon.alias)) {
            throw new Error("Já existe um cupom com este código.");
        }
        coupons.push(coupon);
        saveCoupons(coupons);
        return coupon;
    }
    update(id, patch) {
        const coupons = loadCoupons();
        const index = coupons.findIndex((coupon) => coupon.id === id);
        if (index === -1)
            return null;
        const next = {
            ...coupons[index],
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        coupons[index] = next;
        saveCoupons(coupons);
        return next;
    }
}
exports.WabaCouponRepository = WabaCouponRepository;
