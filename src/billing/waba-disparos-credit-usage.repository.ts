import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import { resolveDataFile } from "../data-path";

type CreditUsageEntry = {
  email: string;
  consumedOficial: number;
  consumedAlternativa: number;
  /** Consumo aplicado a grants admin-bonus-envios (não pode herdar dívida antiga). */
  bonusConsumedOficial?: number;
  bonusConsumedAlternativa?: number;
  updatedAt: string;
};

type LegacyCreditUsageEntry = {
  email: string;
  consumedShipments?: number;
  updatedAt?: string;
};

type Store = {
  version: 2;
  entries: CreditUsageEntry[];
};

const FILE_NAME = "waba-disparos-credit-usage.json";

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

const readStore = (): Store => {
  ensureStorage();
  try {
    const parsed = JSON.parse(readFileSync(resolveFilePath(), "utf-8")) as {
      version?: number;
      entries?: unknown[];
    };
    if (parsed?.version === 2 && Array.isArray(parsed.entries)) {
      return { version: 2, entries: parsed.entries as CreditUsageEntry[] };
    }
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
      const migrated: Store = {
        version: 2,
        entries: (parsed.entries as LegacyCreditUsageEntry[]).map((item) => ({
          email: normalizeEmail(item.email),
          consumedOficial: Math.max(0, Math.round(Number(item.consumedShipments ?? 0))),
          consumedAlternativa: 0,
          updatedAt: String(item.updatedAt ?? new Date().toISOString()),
        })),
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

export class WabaDisparosCreditUsageRepository {
  getConsumedShipments(email: string, apiKind?: WabaDispatchesApiKind): number {
    const normalized = normalizeEmail(email);
    if (!normalized) return 0;
    const entry = readStore().entries.find((item) => item.email === normalized);
    if (!entry) return 0;
    if (apiKind === "alternativa") {
      return Math.max(0, Math.round(Number(entry.consumedAlternativa ?? 0)));
    }
    if (apiKind === "oficial") {
      return Math.max(0, Math.round(Number(entry.consumedOficial ?? 0)));
    }
    return (
      Math.max(0, Math.round(Number(entry.consumedOficial ?? 0))) +
      Math.max(0, Math.round(Number(entry.consumedAlternativa ?? 0)))
    );
  }

  getBonusConsumedShipments(email: string, apiKind: WabaDispatchesApiKind): number {
    const normalized = normalizeEmail(email);
    if (!normalized) return 0;
    const entry = readStore().entries.find((item) => item.email === normalized);
    if (!entry) return 0;
    if (apiKind === "alternativa") {
      return Math.max(0, Math.round(Number(entry.bonusConsumedAlternativa ?? 0)));
    }
    return Math.max(0, Math.round(Number(entry.bonusConsumedOficial ?? 0)));
  }

  setConsumedByApi(
    email: string,
    consumedByApi: { oficial: number; alternativa: number },
  ): void {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const store = readStore();
    const now = new Date().toISOString();
    const index = store.entries.findIndex((item) => item.email === normalized);
    const current = index >= 0 ? store.entries[index] : null;
    const next: CreditUsageEntry = {
      email: normalized,
      consumedOficial: Math.max(0, Math.round(consumedByApi.oficial)),
      consumedAlternativa: Math.max(0, Math.round(consumedByApi.alternativa)),
      bonusConsumedOficial: Math.max(0, Math.round(Number(current?.bonusConsumedOficial ?? 0))),
      bonusConsumedAlternativa: Math.max(
        0,
        Math.round(Number(current?.bonusConsumedAlternativa ?? 0)),
      ),
      updatedAt: now,
    };
    if (index >= 0) {
      store.entries[index] = next;
    } else {
      store.entries.push(next);
    }
    writeStore(store);
  }

  incrementConsumedShipments(
    email: string,
    delta = 1,
    apiKind: WabaDispatchesApiKind = "oficial",
  ): number {
    const normalized = normalizeEmail(email);
    if (!normalized || !Number.isFinite(delta) || delta <= 0) {
      return this.getConsumedShipments(normalized, apiKind);
    }

    const store = readStore();
    const now = new Date().toISOString();
    const index = store.entries.findIndex((item) => item.email === normalized);
    const roundedDelta = Math.round(delta);

    if (index === -1) {
      store.entries.push({
        email: normalized,
        consumedOficial: apiKind === "oficial" ? roundedDelta : 0,
        consumedAlternativa: apiKind === "alternativa" ? roundedDelta : 0,
        bonusConsumedOficial: 0,
        bonusConsumedAlternativa: 0,
        updatedAt: now,
      });
    } else {
      const current = store.entries[index];
      store.entries[index] = {
        ...current,
        consumedOficial:
          apiKind === "oficial"
            ? Math.max(0, Math.round(Number(current.consumedOficial ?? 0))) + roundedDelta
            : Math.max(0, Math.round(Number(current.consumedOficial ?? 0))),
        consumedAlternativa:
          apiKind === "alternativa"
            ? Math.max(0, Math.round(Number(current.consumedAlternativa ?? 0))) + roundedDelta
            : Math.max(0, Math.round(Number(current.consumedAlternativa ?? 0))),
        bonusConsumedOficial: Math.max(0, Math.round(Number(current.bonusConsumedOficial ?? 0))),
        bonusConsumedAlternativa: Math.max(
          0,
          Math.round(Number(current.bonusConsumedAlternativa ?? 0)),
        ),
        updatedAt: now,
      };
    }
    writeStore(store);
    return this.getConsumedShipments(normalized, apiKind);
  }

  incrementBonusConsumedShipments(
    email: string,
    delta = 1,
    apiKind: WabaDispatchesApiKind = "oficial",
  ): number {
    const normalized = normalizeEmail(email);
    if (!normalized || !Number.isFinite(delta) || delta <= 0) {
      return this.getBonusConsumedShipments(normalized, apiKind);
    }

    const store = readStore();
    const now = new Date().toISOString();
    const index = store.entries.findIndex((item) => item.email === normalized);
    const roundedDelta = Math.round(delta);

    if (index === -1) {
      store.entries.push({
        email: normalized,
        consumedOficial: 0,
        consumedAlternativa: 0,
        bonusConsumedOficial: apiKind === "oficial" ? roundedDelta : 0,
        bonusConsumedAlternativa: apiKind === "alternativa" ? roundedDelta : 0,
        updatedAt: now,
      });
    } else {
      const current = store.entries[index];
      store.entries[index] = {
        ...current,
        bonusConsumedOficial:
          apiKind === "oficial"
            ? Math.max(0, Math.round(Number(current.bonusConsumedOficial ?? 0))) + roundedDelta
            : Math.max(0, Math.round(Number(current.bonusConsumedOficial ?? 0))),
        bonusConsumedAlternativa:
          apiKind === "alternativa"
            ? Math.max(0, Math.round(Number(current.bonusConsumedAlternativa ?? 0))) + roundedDelta
            : Math.max(0, Math.round(Number(current.bonusConsumedAlternativa ?? 0))),
        updatedAt: now,
      };
    }
    writeStore(store);
    return this.getBonusConsumedShipments(normalized, apiKind);
  }
}
