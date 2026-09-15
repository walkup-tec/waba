import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import { metaBusinessIdsMatch } from "./meta-whatsapp-known-owned-wabas";

export type ManualBusinessRow = {
  id: string;
  name: string;
};

type Store = {
  version: 1;
  byTenant: Record<string, ManualBusinessRow[]>;
};

const FILE_NAME = "meta-whatsapp-manual-businesses.json";

function storePath(): string {
  return path.join(resolveDataDir(), FILE_NAME);
}

function emptyStore(): Store {
  return { version: 1, byTenant: {} };
}

function readStore(): Store {
  const file = storePath();
  if (!existsSync(file)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Store;
    if (parsed?.version !== 1 || !parsed.byTenant || typeof parsed.byTenant !== "object") {
      return emptyStore();
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store), "utf8");
}

export function normalizeManualBusinessId(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function listManualBusinesses(tenantId: string): ManualBusinessRow[] {
  const key = String(tenantId || "").trim();
  if (!key) return [];
  const rows = readStore().byTenant[key] || [];
  return rows
    .map((row) => ({
      id: normalizeManualBusinessId(row.id),
      name: String(row.name || "").trim(),
    }))
    .filter((row) => row.id.length >= 6);
}

export function listManualBusinessIds(tenantId: string): string[] {
  return listManualBusinesses(tenantId).map((row) => row.id);
}

export function addManualBusiness(tenantId: string, businessId: string, name = ""): ManualBusinessRow {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  const label = String(name || "").trim();
  if (!key || id.length < 6) {
    throw new Error("ID do portfólio inválido.");
  }
  const store = readStore();
  const current = store.byTenant[key] || [];
  const next: ManualBusinessRow = { id, name: label };
  const idx = current.findIndex((row) => metaBusinessIdsMatch(row.id, id));
  if (idx >= 0) {
    current[idx] = { id, name: label || current[idx].name };
  } else {
    current.push(next);
  }
  store.byTenant[key] = current;
  writeStore(store);
  return current[idx >= 0 ? idx : current.length - 1];
}
