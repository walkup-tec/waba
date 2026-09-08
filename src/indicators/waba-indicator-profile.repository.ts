import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataFile } from "../data-path";
import { toNonNegativeCents } from "../billing/waba-money-cents";
import type { AsaasPixAddressKeyType } from "../billing/asaas-pix-key";

export type IndicatorProfileStatus = "active" | "inactive";

export type WabaIndicatorProfile = {
  id: string;
  userId: string;
  cpfCnpj: string;
  pixKey: string;
  pixKeyType: AsaasPixAddressKeyType;
  spreadCentsPerSend: number;
  status: IndicatorProfileStatus;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;
  profiles: WabaIndicatorProfile[];
};

const FILE_NAME = "waba-indicator-profiles.json";

const emptyStore = (): Store => ({ version: 1, profiles: [] });

const normalizeStatus = (value: unknown): IndicatorProfileStatus =>
  String(value ?? "").trim().toLowerCase() === "inactive" ? "inactive" : "active";

export class WabaIndicatorProfileRepository {
  private readStore(): Store {
    const filePath = resolveDataFile(FILE_NAME);
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(filePath)) return emptyStore();
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
      if (parsed?.version !== 1 || !Array.isArray(parsed.profiles)) return emptyStore();
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

  list(): WabaIndicatorProfile[] {
    return this.readStore().profiles.slice();
  }

  getById(id: string): WabaIndicatorProfile | null {
    const normalized = String(id ?? "").trim();
    if (!normalized) return null;
    return this.list().find((item) => item.id === normalized) ?? null;
  }

  getByUserId(userId: string): WabaIndicatorProfile | null {
    const normalized = String(userId ?? "").trim();
    if (!normalized) return null;
    return this.list().find((item) => item.userId === normalized) ?? null;
  }

  create(profile: WabaIndicatorProfile): WabaIndicatorProfile {
    const store = this.readStore();
    if (store.profiles.some((item) => item.userId === profile.userId)) {
      throw new Error("Já existe um perfil de indicador para este usuário.");
    }
    store.profiles.push({
      ...profile,
      spreadCentsPerSend: toNonNegativeCents(profile.spreadCentsPerSend),
      status: normalizeStatus(profile.status),
    });
    this.writeStore(store);
    return profile;
  }

  updateByUserId(
    userId: string,
    patch: Partial<Omit<WabaIndicatorProfile, "id" | "userId" | "createdAt">>,
  ): WabaIndicatorProfile | null {
    const store = this.readStore();
    const index = store.profiles.findIndex((item) => item.userId === String(userId ?? "").trim());
    if (index < 0) return null;
    const current = store.profiles[index];
    const next: WabaIndicatorProfile = {
      ...current,
      ...patch,
      spreadCentsPerSend: toNonNegativeCents(patch.spreadCentsPerSend ?? current.spreadCentsPerSend),
      status: normalizeStatus(patch.status ?? current.status),
      updatedAt: String(patch.updatedAt ?? new Date().toISOString()),
    };
    store.profiles[index] = next;
    this.writeStore(store);
    return next;
  }
}
