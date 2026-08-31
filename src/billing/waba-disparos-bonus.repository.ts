import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  normalizeDispatchesApiKind,
  resolveOrderApiKind,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import type { WabaBillingOrder } from "./waba-billing-order.repository";
import { WabaBillingOrderRepository } from "./waba-billing-order.repository";
import { resolveDataFile } from "../data-path";

type BonusGrant = {
  campaignId: string;
  shipments: number;
  grantedAt: string;
  apiKind: WabaDispatchesApiKind;
};

type BonusEntry = {
  email: string;
  grants: BonusGrant[];
  updatedAt: string;
};

type LegacyBonusEntry = {
  email: string;
  pendingShipments?: number;
  pendingOficial?: number;
  pendingAlternativa?: number;
  grants?: Array<{ campaignId: string; shipments: number; grantedAt: string; apiKind?: string }>;
  updatedAt?: string;
};

type Store = {
  version: 2;
  entries: BonusEntry[];
};

const FILE_NAME = "waba-disparos-bonus-balances.json";

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const emptyStore = (): Store => ({ version: 2, entries: [] });

const resolveFilePath = (): string => resolveDataFile(FILE_NAME);

const ensureStorage = () => {
  const filePath = resolveFilePath();
  const folder = dirname(filePath);
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(emptyStore(), null, 2), "utf-8");
  }
};

const normalizeGrantApiKind = (value: unknown): WabaDispatchesApiKind => {
  return normalizeDispatchesApiKind(value) ?? "oficial";
};

const migrateLegacyEntry = (legacy: LegacyBonusEntry): BonusEntry => {
  const email = normalizeEmail(legacy.email);
  const now = String(legacy.updatedAt ?? new Date().toISOString());
  const grants: BonusGrant[] = Array.isArray(legacy.grants)
    ? legacy.grants.map((grant) => ({
        campaignId: String(grant.campaignId ?? "").trim(),
        shipments: Math.max(0, Math.round(Number(grant.shipments ?? 0))),
        grantedAt: String(grant.grantedAt ?? now),
        apiKind: normalizeGrantApiKind(grant.apiKind),
      }))
    : [];

  return { email, grants, updatedAt: now };
};

const readStore = (): Store => {
  ensureStorage();
  try {
    const parsed = JSON.parse(readFileSync(resolveFilePath(), "utf-8")) as {
      version?: number;
      entries?: unknown[];
    };
    if (parsed?.version === 2 && Array.isArray(parsed.entries)) {
      return { version: 2, entries: parsed.entries as BonusEntry[] };
    }
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
      const migrated = {
        version: 2 as const,
        entries: (parsed.entries as LegacyBonusEntry[]).map(migrateLegacyEntry),
      };
      writeStore(migrated);
      return migrated;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
};

const writeStore = (store: Store) => {
  ensureStorage();
  writeFileSync(resolveFilePath(), JSON.stringify(store, null, 2), "utf-8");
};

const sumAppliedBonusFromOrders = (
  email: string,
  apiKind: WabaDispatchesApiKind,
  orderRepository: WabaBillingOrderRepository,
): number => {
  const normalized = normalizeEmail(email);
  return orderRepository
    .list()
    .filter(
      (order: WabaBillingOrder) =>
        order.product === "waba-disparos" &&
        order.status === "paid" &&
        normalizeEmail(order.ownerEmail) === normalized &&
        resolveOrderApiKind(order) === apiKind,
    )
    .reduce((sum, order) => sum + Math.max(0, Math.round(Number(order.bonusShipmentsApplied ?? 0))), 0);
};

export class WabaDisparosBonusRepository {
  constructor(private readonly orderRepository = new WabaBillingOrderRepository()) {}

  private getEntry(email: string): BonusEntry | null {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    return readStore().entries.find((item) => item.email === normalized) ?? null;
  }

  getPendingShipments(email: string, apiKind: WabaDispatchesApiKind): number {
    const entry = this.getEntry(email);
    if (!entry) return 0;

    const granted = entry.grants
      .filter((grant) => grant.apiKind === apiKind)
      .reduce((sum, grant) => sum + Math.max(0, Math.round(Number(grant.shipments ?? 0))), 0);
    const applied = sumAppliedBonusFromOrders(email, apiKind, this.orderRepository);
    return Math.max(0, granted - applied);
  }

  getPendingShipmentsTotal(email: string): number {
    return (
      this.getPendingShipments(email, "oficial") + this.getPendingShipments(email, "alternativa")
    );
  }

  getEarliestGrantAt(email: string, apiKind: WabaDispatchesApiKind): string {
    const entry = this.getEntry(email);
    if (!entry) return "";

    const grantDates = entry.grants
      .filter((grant) => grant.apiKind === apiKind)
      .map((grant) => String(grant.grantedAt ?? "").trim())
      .filter((value) => value.length > 0)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return grantDates[0] ?? "";
  }

  grantFromCampaign(
    email: string,
    campaignId: string,
    shipments: number,
    apiKind: WabaDispatchesApiKind,
  ): number {
    const normalized = normalizeEmail(email);
    const campaignKey = String(campaignId ?? "").trim();
    const amount = Math.max(0, Math.round(Number(shipments)));
    if (!normalized || !campaignKey || amount <= 0) {
      return this.getPendingShipments(normalized, apiKind);
    }

    const store = readStore();
    const now = new Date().toISOString();
    const index = store.entries.findIndex((item) => item.email === normalized);
    const current: BonusEntry =
      index >= 0
        ? store.entries[index]
        : { email: normalized, grants: [], updatedAt: now };

    if (current.grants.some((grant) => grant.campaignId === campaignKey)) {
      return this.getPendingShipments(normalized, apiKind);
    }

    const next: BonusEntry = {
      ...current,
      grants: [
        ...current.grants,
        { campaignId: campaignKey, shipments: amount, grantedAt: now, apiKind },
      ],
      updatedAt: now,
    };

    if (index >= 0) {
      store.entries[index] = next;
    } else {
      store.entries.push(next);
    }
    writeStore(store);
    return this.getPendingShipments(normalized, apiKind);
  }

  clearPendingShipments(email: string, apiKind: WabaDispatchesApiKind): number {
    return this.getPendingShipments(email, apiKind);
  }

  listGrantHistory(
    email: string,
    limit = 20,
  ): Array<{
    campaignId: string;
    shipments: number;
    grantedAt: string;
    apiKind: WabaDispatchesApiKind;
    status: "pending" | "applied";
  }> {
    const entry = this.getEntry(email);
    if (!entry) return [];

    const cap = Math.max(1, Math.min(50, Math.floor(limit)));
    const appliedBudget: Record<WabaDispatchesApiKind, number> = {
      oficial: sumAppliedBonusFromOrders(email, "oficial", this.orderRepository),
      alternativa: sumAppliedBonusFromOrders(email, "alternativa", this.orderRepository),
    };

    const grantsOldestFirst = [...entry.grants].sort(
      (a, b) => new Date(a.grantedAt).getTime() - new Date(b.grantedAt).getTime(),
    );

    const statusByCampaignId = new Map<string, "pending" | "applied">();
    for (const kind of ["oficial", "alternativa"] as const) {
      let remainingApplied = appliedBudget[kind];
      for (const grant of grantsOldestFirst.filter((item) => item.apiKind === kind)) {
        const amount = Math.max(0, Math.round(Number(grant.shipments ?? 0)));
        if (remainingApplied >= amount && amount > 0) {
          statusByCampaignId.set(grant.campaignId, "applied");
          remainingApplied -= amount;
        } else {
          statusByCampaignId.set(grant.campaignId, "pending");
        }
      }
    }

    return [...entry.grants]
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
      .slice(0, cap)
      .map((grant) => ({
        campaignId: grant.campaignId,
        shipments: Math.max(0, Math.round(Number(grant.shipments ?? 0))),
        grantedAt: String(grant.grantedAt ?? ""),
        apiKind: grant.apiKind,
        status: statusByCampaignId.get(grant.campaignId) ?? "pending",
      }));
  }
}
