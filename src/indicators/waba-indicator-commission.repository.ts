import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";
import { toNonNegativeCents } from "../billing/waba-money-cents";

export type IndicatorCommissionStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "canceled";

export type WabaIndicatorCommission = {
  id: string;
  indicatorUserId: string;
  subscriberId: string;
  subscriberEmail: string;
  orderId: string;
  asaasPaymentId: string;
  campaignId: string;
  quantity: number;
  baseUnitPriceCents: number;
  spreadUnitPriceCents: number;
  customerUnitPriceCents: number;
  baseAmountCents: number;
  commissionAmountCents: number;
  totalAmountCents: number;
  status: IndicatorCommissionStatus;
  payoutExternalReference: string;
  asaasTransferId: string;
  transactionReceiptUrl: string;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string;
  canceledAt: string;
};

type Store = {
  version: 1;
  commissions: WabaIndicatorCommission[];
};

const FILE_NAME = "waba-indicator-commissions.json";

const emptyStore = (): Store => ({ version: 1, commissions: [] });

const STATUSES: IndicatorCommissionStatus[] = [
  "pending",
  "processing",
  "paid",
  "failed",
  "canceled",
];

const normalizeStatus = (value: unknown): IndicatorCommissionStatus => {
  const raw = String(value ?? "").trim().toLowerCase();
  return STATUSES.includes(raw as IndicatorCommissionStatus)
    ? (raw as IndicatorCommissionStatus)
    : "pending";
};

export class WabaIndicatorCommissionRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.commissions)) return emptyStore();
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: Store) {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
    renameSync(tmp, filePath);
  }

  list(): WabaIndicatorCommission[] {
    return this.readStore().commissions.slice();
  }

  getById(id: string): WabaIndicatorCommission | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    return this.list().find((item) => item.id === normalized) ?? null;
  }

  getByOrderId(orderId: string): WabaIndicatorCommission | null {
    const normalized = String(orderId ?? "").trim();
    if (!normalized) return null;
    return this.list().find((item) => item.orderId === normalized) ?? null;
  }

  listByIndicatorUserId(indicatorUserId: string): WabaIndicatorCommission[] {
    const normalized = String(indicatorUserId ?? "").trim();
    if (!normalized) return [];
    return this.list().filter((item) => item.indicatorUserId === normalized);
  }

  createIfAbsent(commission: WabaIndicatorCommission): {
    commission: WabaIndicatorCommission;
    created: boolean;
  } {
    const store = this.readStore();
    const existing = store.commissions.find((item) => item.orderId === commission.orderId);
    if (existing) return { commission: existing, created: false };
    store.commissions.push({
      ...commission,
      quantity: Math.max(0, Math.round(Number(commission.quantity ?? 0))),
      baseUnitPriceCents: toNonNegativeCents(commission.baseUnitPriceCents),
      spreadUnitPriceCents: toNonNegativeCents(commission.spreadUnitPriceCents),
      customerUnitPriceCents: toNonNegativeCents(commission.customerUnitPriceCents),
      baseAmountCents: toNonNegativeCents(commission.baseAmountCents),
      commissionAmountCents: toNonNegativeCents(commission.commissionAmountCents),
      totalAmountCents: toNonNegativeCents(commission.totalAmountCents),
      status: normalizeStatus(commission.status),
    });
    this.writeStore(store);
    return { commission, created: true };
  }

  updateById(
    id: string,
    patch: Partial<Omit<WabaIndicatorCommission, "id" | "orderId" | "createdAt">>,
  ): WabaIndicatorCommission | null {
    const store = this.readStore();
    const index = store.commissions.findIndex((item) => item.id === String(id ?? "").trim());
    if (index < 0) return null;
    const current = store.commissions[index];
    const next: WabaIndicatorCommission = {
      ...current,
      ...patch,
      status: normalizeStatus(patch.status ?? current.status),
      updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
    };
    store.commissions[index] = next;
    this.writeStore(store);
    return next;
  }
}
