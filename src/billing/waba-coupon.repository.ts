import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDataFile } from "../data-path";
import { normalizeWabaCouponAlias } from "./waba-coupon-identifiers";

export type WabaCouponValidityMode = "12h" | "24h" | "custom" | "lifetime";

export type WabaCoupon = {
  id: string;
  alias: string;
  discountPercent: number;
  validityMode: WabaCouponValidityMode;
  validFrom: string;
  validUntil?: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  maxRedemptions?: number;
  redemptionCount: number;
};

const COUPONS_FILE = resolveDataFile("waba-coupons.json");

const ensureStorage = () => {
  const folder = dirname(COUPONS_FILE);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  if (!existsSync(COUPONS_FILE)) {
    writeFileSync(COUPONS_FILE, "[]", "utf-8");
  }
};

const loadCoupons = (): WabaCoupon[] => {
  ensureStorage();
  try {
    const raw = readFileSync(COUPONS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as WabaCoupon[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCoupons = (coupons: WabaCoupon[]) => {
  ensureStorage();
  writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2), "utf-8");
};

export class WabaCouponRepository {
  list(): WabaCoupon[] {
    return loadCoupons();
  }

  getById(id: string): WabaCoupon | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    return loadCoupons().find((coupon) => coupon.id === normalized) ?? null;
  }

  getByAlias(alias: string): WabaCoupon | null {
    const normalized = normalizeWabaCouponAlias(alias);
    if (!normalized) return null;
    return loadCoupons().find((coupon) => coupon.alias === normalized) ?? null;
  }

  create(coupon: WabaCoupon): WabaCoupon {
    const coupons = loadCoupons();
    if (coupons.some((item) => item.alias === coupon.alias)) {
      throw new Error("Já existe um cupom com este código.");
    }
    coupons.push(coupon);
    saveCoupons(coupons);
    return coupon;
  }

  update(id: string, patch: Partial<WabaCoupon>): WabaCoupon | null {
    const coupons = loadCoupons();
    const index = coupons.findIndex((coupon) => coupon.id === id);
    if (index === -1) return null;
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
