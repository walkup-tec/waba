import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";
import { metaBusinessIdsMatch } from "./meta-whatsapp-known-owned-wabas";

export type ManualBusinessRow = {
  id: string;
  name: string;
  wabaId?: string;
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

export function normalizeManualWabaId(value: string): string {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6) return digits;
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw)) return raw;
  return "";
}

export function listManualBusinesses(tenantId: string): ManualBusinessRow[] {
  const key = String(tenantId || "").trim();
  if (!key) return [];
  const rows = readStore().byTenant[key] || [];
  return rows
    .map((row) => {
      const wabaId = normalizeManualWabaId(String(row.wabaId || ""));
      return {
        id: normalizeManualBusinessId(row.id),
        name: String(row.name || "").trim(),
        ...(wabaId ? { wabaId } : {}),
      };
    })
    .filter((row) => row.id.length >= 6);
}

export function listManualBusinessIds(tenantId: string): string[] {
  return listManualBusinesses(tenantId).map((row) => row.id);
}

export function addManualBusiness(
  tenantId: string,
  businessId: string,
  name = "",
  wabaId = "",
): ManualBusinessRow {
  const key = String(tenantId || "").trim();
  const id = normalizeManualBusinessId(businessId);
  const label = String(name || "").trim();
  const storedWaba = normalizeManualWabaId(wabaId);
  if (!key || id.length < 6) {
    throw new Error("ID do portfólio inválido.");
  }
  const store = readStore();
  const current = store.byTenant[key] || [];
  const idx = current.findIndex((row) => metaBusinessIdsMatch(row.id, id));
  const prev = idx >= 0 ? current[idx] : null;
  const next: ManualBusinessRow = {
    id,
    name: label || prev?.name || "",
    ...(storedWaba || prev?.wabaId
      ? { wabaId: storedWaba || normalizeManualWabaId(String(prev?.wabaId || "")) }
      : {}),
  };
  if (!next.wabaId) delete next.wabaId;
  if (idx >= 0) current[idx] = next;
  else current.push(next);
  store.byTenant[key] = current;
  writeStore(store);
  return next;
}
