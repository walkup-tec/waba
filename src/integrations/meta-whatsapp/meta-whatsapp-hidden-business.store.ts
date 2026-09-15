import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import { metaBusinessIdsMatch } from "./meta-whatsapp-known-owned-wabas";
import { normalizeManualBusinessId } from "./meta-whatsapp-manual-business.store";

export type HiddenBusinessRow = {
  id: string;
  name: string;
};

type Store = {
  version: 1;
  byTenant: Record<string, Array<string | HiddenBusinessRow>>;
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

function normalizeHiddenRows(rows: unknown): HiddenBusinessRow[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: HiddenBusinessRow[] = [];
  for (const row of rows) {
    const raw = row && typeof row === "object" ? (row as HiddenBusinessRow) : { id: String(row || ""), name: "" };
    const id = normalizeManualBusinessId(String(raw.id || ""));
    if (id.length < 6 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: String(raw.name || "").trim() });
  }
  return out;
}

export function listHiddenBusinesses(tenantId: string): HiddenBusinessRow[] {
  const key = String(tenantId || "").trim();
  if (!key) return [];
  return normalizeHiddenRows(readStore().byTenant[key]);
}

export function listHiddenBusinessIds(tenantId: string): string[] {
  return listHiddenBusinesses(tenantId).map((row) => row.id);
}

export function isHiddenBusiness(tenantId: string, businessId: string): boolean {
  const id = normalizeManualBusinessId(businessId);
  if (id.length < 6) return false;
  return listHiddenBusinessIds(tenantId).some((hidden) => metaBusinessIdsMatch(hidden, id));
}

export function hideBusiness(tenantId: string, businessId: string, name = ""): HiddenBusinessRow {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  const label = String(name || "").trim();
  if (!key || id.length < 6) {
    throw new Error("ID do portfólio inválido.");
  }
  const store = readStore();
  const current = normalizeHiddenRows(store.byTenant[key]);
  const idx = current.findIndex((row) => metaBusinessIdsMatch(row.id, id));
  if (idx >= 0) {
    current[idx] = { id, name: label || current[idx].name };
  } else {
    current.push({ id, name: label });
  }
  store.byTenant[key] = current;
  writeStore(store);
  return current[idx >= 0 ? idx : current.length - 1];
}

export function unhideBusiness(tenantId: string, businessId: string): void {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  if (!key || id.length < 6) return;
  const store = readStore();
  const current = normalizeHiddenRows(store.byTenant[key]);
  const next = current.filter((row) => !metaBusinessIdsMatch(row.id, id));
  if (next.length === current.length) return;
  if (next.length) store.byTenant[key] = next;
  else delete store.byTenant[key];
  writeStore(store);
}
