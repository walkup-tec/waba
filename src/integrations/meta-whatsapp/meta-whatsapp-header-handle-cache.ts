import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveDataDir } from "../../data-path";

const TENANT_ID_RE = /^[a-zA-Z0-9._-]{8,80}$/;
export const HEADER_HANDLE_CACHE_TTL_MS = 45 * 60 * 1000;

type CachedHeaderHandle = {
  handle: string;
  at: number;
};

const memory = new Map<string, CachedHeaderHandle>();

function safeTenantId(tenantId: string): string {
  const id = String(tenantId || "").trim();
  if (!id) return "";
  if (TENANT_ID_RE.test(id)) return id;
  return createHash("sha256").update(id).digest("hex").slice(0, 40);
}

export function headerFileSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function memoryKey(tenantId: string, sha: string): string {
  return `${safeTenantId(tenantId)}:${String(sha || "").trim().toLowerCase()}`;
}

function handleDir(tenantId: string): string {
  return path.join(resolveDataDir(), "meta-whatsapp", "template-headers", safeTenantId(tenantId), "handles");
}

function handlePath(tenantId: string, sha: string): string {
  return path.join(handleDir(tenantId), `${String(sha || "").trim().toLowerCase()}.json`);
}

function stillFresh(at: number, now: number): boolean {
  return Number.isFinite(at) && now - at >= 0 && now - at <= HEADER_HANDLE_CACHE_TTL_MS;
}

export function readCachedHeaderHandle(tenantId: string, sha: string, now = Date.now()): string {
  const id = safeTenantId(tenantId);
  const hash = String(sha || "").trim().toLowerCase();
  if (!id || !/^[a-f0-9]{64}$/.test(hash)) return "";
  const mem = memory.get(memoryKey(tenantId, hash));
  if (mem && stillFresh(mem.at, now) && mem.handle) return mem.handle;
  if (mem) memory.delete(memoryKey(tenantId, hash));
  const file = handlePath(tenantId, hash);
  if (!existsSync(file)) return "";
  try {
    const row = JSON.parse(readFileSync(file, "utf8")) as { handle?: unknown; at?: unknown };
    const handle = String(row.handle || "").trim();
    const at = Number(row.at || 0);
    if (!handle || !stillFresh(at, now)) return "";
    memory.set(memoryKey(tenantId, hash), { handle, at });
    return handle;
  } catch {
    return "";
  }
}

export function writeCachedHeaderHandle(tenantId: string, sha: string, handle: string, now = Date.now()): void {
  const id = safeTenantId(tenantId);
  const hash = String(sha || "").trim().toLowerCase();
  const value = String(handle || "").trim();
  if (!id || !/^[a-f0-9]{64}$/.test(hash) || !value) return;
  const row: CachedHeaderHandle = { handle: value, at: now };
  memory.set(memoryKey(tenantId, hash), row);
  mkdirSync(handleDir(tenantId), { recursive: true });
  writeFileSync(handlePath(tenantId, hash), JSON.stringify(row));
}

export function clearHeaderHandleCacheForTests(): void {
  memory.clear();
}
