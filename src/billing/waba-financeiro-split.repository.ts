import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";

export type SplitSupplier = {
  id: string;
  name: string;
  apiKind: WabaDispatchesApiKind;
  costPerShipmentCents: number;
  pixKey: string;
  active: boolean;
};

export type SplitParticipant = {
  id: string;
  label: string;
  email: string;
  pixKey: string;
  sharePercent: number;
  active: boolean;
};

export type FinanceiroSplitConfig = {
  version: 2;
  suppliers: SplitSupplier[];
  participants: SplitParticipant[];
  updatedAt: string;
};

const FILE_NAME = "waba-financeiro-split-config.json";

const defaultConfig = (): FinanceiroSplitConfig => ({
  version: 2,
  suppliers: [],
  participants: [],
  updatedAt: new Date().toISOString(),
});

const normalizeParticipant = (input: Partial<SplitParticipant>): SplitParticipant => ({
  id: String(input.id ?? randomUUID()).trim() || randomUUID(),
  label: String(input.label ?? "").trim(),
  email: String(input.email ?? "").trim().toLowerCase(),
  pixKey: String(input.pixKey ?? "").trim(),
  sharePercent: Math.max(0, Math.min(100, Number(input.sharePercent ?? 0))),
  active: input.active !== false,
});

const migrateLegacyConfig = (parsed: Record<string, unknown>): FinanceiroSplitConfig => {
  const costs = (parsed.costPerShipmentCents ?? {}) as Record<string, number>;
  const oficialCost = Math.max(0, Math.round(Number(costs.oficial ?? 19)));
  const alternativaCost = Math.max(0, Math.round(Number(costs.alternativa ?? 10)));
  const suppliers: SplitSupplier[] = [];

  if (oficialCost > 0) {
    suppliers.push({
      id: "supplier-oficial",
      name: "Fornecedor API Oficial",
      apiKind: "oficial",
      costPerShipmentCents: oficialCost,
      pixKey: "",
      active: true,
    });
  }
  if (alternativaCost > 0) {
    suppliers.push({
      id: "supplier-alternativa",
      name: "Fornecedor API Alternativa",
      apiKind: "alternativa",
      costPerShipmentCents: alternativaCost,
      pixKey: "",
      active: true,
    });
  }

  return {
    version: 2,
    suppliers,
    participants: Array.isArray(parsed.participants)
      ? parsed.participants.map((item) => normalizeParticipant(item as Partial<SplitParticipant>))
      : [],
    updatedAt: String(parsed.updatedAt || new Date().toISOString()),
  };
};

const normalizeSupplier = (input: Partial<SplitSupplier>): SplitSupplier => {
  const apiKind = input.apiKind === "alternativa" ? "alternativa" : "oficial";
  return {
    id: String(input.id ?? randomUUID()).trim() || randomUUID(),
    name: String(input.name ?? "").trim(),
    apiKind,
    costPerShipmentCents: Math.max(0, Math.round(Number(input.costPerShipmentCents ?? 0))),
    pixKey: String(input.pixKey ?? "").trim(),
    active: input.active !== false,
  };
};

export class WabaFinanceiroSplitRepository {
  private readConfigFromDisk(): { config: FinanceiroSplitConfig; legacyFormat: boolean } {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) {
      return { config: defaultConfig(), legacyFormat: false };
    }
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
      if (parsed?.version === 2 && Array.isArray(parsed.suppliers)) {
        return {
          config: {
            version: 2,
            suppliers: parsed.suppliers.map((item) =>
              normalizeSupplier(item as Partial<SplitSupplier>),
            ),
            participants: Array.isArray(parsed.participants)
              ? parsed.participants.map((item) =>
                  normalizeParticipant(item as Partial<SplitParticipant>),
                )
              : [],
            updatedAt: String(parsed.updatedAt || new Date().toISOString()),
          },
          legacyFormat: false,
        };
      }
      return { config: migrateLegacyConfig(parsed ?? {}), legacyFormat: true };
    } catch {
      return { config: defaultConfig(), legacyFormat: false };
    }
  }

  get(): FinanceiroSplitConfig {
    const { config, legacyFormat } = this.readConfigFromDisk();
    if (legacyFormat) {
      return this.save(config);
    }
    return config;
  }

  save(config: FinanceiroSplitConfig): FinanceiroSplitConfig {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: FinanceiroSplitConfig = {
      version: 2,
      suppliers: (Array.isArray(config.suppliers) ? config.suppliers : []).map(normalizeSupplier),
      participants: (Array.isArray(config.participants) ? config.participants : []).map(
        normalizeParticipant,
      ),
      updatedAt: new Date().toISOString(),
    };
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    writeFileSync(filePath, readFileSync(tmp));
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // ignore tmp cleanup failure
    }
    return payload;
  }
}
