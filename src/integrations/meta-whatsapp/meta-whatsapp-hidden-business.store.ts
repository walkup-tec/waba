import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import { metaBusinessIdsMatch } from "./meta-whatsapp-known-owned-wabas";
import { normalizeManualBusinessId } from "./meta-whatsapp-manual-business.store";

type Store = {
  version: 1;
  byTenant: Record<string, string[]>;
};

const FILE_NAME = "meta-whatsapp-hidden-businesses.json";

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

function normalizeHiddenIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of rows) {
    const id = normalizeManualBusinessId(String(row || ""));
    if (id.length < 6 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function listHiddenBusinessIds(tenantId: string): string[] {
  const key = String(tenantId || "").trim();
  if (!key) return [];
  return normalizeHiddenIds(readStore().byTenant[key]);
}

export function isHiddenBusiness(tenantId: string, businessId: string): boolean {
  const id = normalizeManualBusinessId(businessId);
  if (id.length < 6) return false;
  return listHiddenBusinessIds(tenantId).some((hidden) => metaBusinessIdsMatch(hidden, id));
}

export function hideBusiness(tenantId: string, businessId: string): string {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  if (!key || id.length < 6) {
    throw new Error("ID do portfólio inválido.");
  }
  const store = readStore();
  const current = normalizeHiddenIds(store.byTenant[key]);
  if (!current.some((hidden) => metaBusinessIdsMatch(hidden, id))) {
    current.push(id);
  }
  store.byTenant[key] = current;
  writeStore(store);
  return id;
}

export function unhideBusiness(tenantId: string, businessId: string): void {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  if (!key || id.length < 6) return;
  const store = readStore();
  const current = normalizeHiddenIds(store.byTenant[key]);
  const next = current.filter((hidden) => !metaBusinessIdsMatch(hidden, id));
  if (next.length === current.length) return;
  if (next.length) store.byTenant[key] = next;
  else delete store.byTenant[key];
  writeStore(store);
}
