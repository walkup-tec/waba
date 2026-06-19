import fs from "fs/promises";
import path from "path";
import { resolveDataFile } from "../data-path";

export type WabaShortLinkRecord = {
  id: string;
  slug: string;
  longUrl: string;
  tenantId: string;
  createdAt: string;
  clicks: number;
};

type WabaShortenerStore = {
  links: WabaShortLinkRecord[];
};

const STORE_FILE = resolveDataFile("shortener-links.json");

let storeCache: WabaShortenerStore | null = null;
let slugIndex = new Map<string, WabaShortLinkRecord>();

function rebuildIndex(store: WabaShortenerStore) {
  slugIndex = new Map(
    store.links.filter((row) => row.slug).map((row) => [row.slug, row])
  );
}

async function loadStore(): Promise<WabaShortenerStore> {
  if (storeCache) return storeCache;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw.trim() || "{}");
    const links = Array.isArray(parsed?.links) ? parsed.links : [];
    storeCache = {
      links: links.map((row: Record<string, unknown>) => ({
        id: String(row?.id || ""),
        slug: String(row?.slug || ""),
        longUrl: String(row?.longUrl || row?.long_url || ""),
        tenantId: String(row?.tenantId || row?.tenant_id || "default"),
        createdAt: String(row?.createdAt || row?.created_at || new Date().toISOString()),
        clicks: Math.max(0, Number(row?.clicks || 0)),
      })),
    };
  } catch {
    storeCache = { links: [] };
  }
  rebuildIndex(storeCache);
  return storeCache;
}

async function persistStore(store: WabaShortenerStore): Promise<void> {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
  const tmp = `${STORE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmp, STORE_FILE);
  storeCache = store;
  rebuildIndex(store);
}

export async function findShortLinkBySlug(slug: string): Promise<WabaShortLinkRecord | null> {
  await loadStore();
  return slugIndex.get(slug) ?? null;
}

export async function createShortLinkRecord(input: {
  id: string;
  slug: string;
  longUrl: string;
  tenantId?: string;
}): Promise<WabaShortLinkRecord> {
  const store = await loadStore();
  const existing = slugIndex.get(input.slug);
  if (existing) {
    if (existing.longUrl === input.longUrl) return existing;
    throw new Error("slug já existe para outra URL");
  }
  const record: WabaShortLinkRecord = {
    id: input.id,
    slug: input.slug,
    longUrl: input.longUrl,
    tenantId: String(input.tenantId || "default"),
    createdAt: new Date().toISOString(),
    clicks: 0,
  };
  store.links.push(record);
  await persistStore(store);
  return record;
}

export async function incrementShortLinkClicks(slug: string): Promise<number> {
  const store = await loadStore();
  const record = slugIndex.get(slug);
  if (!record) return 0;
  record.clicks = Math.max(0, Number(record.clicks || 0)) + 1;
  await persistStore(store);
  return record.clicks;
}

export async function getShortLinkClicksByUrl(shortUrl: string): Promise<number | null> {
  const slug = extractSlugFromPublicShortUrl(shortUrl);
  if (!slug) return null;
  const record = await findShortLinkBySlug(slug);
  if (!record) return null;
  return Math.max(0, Number(record.clicks || 0));
}

export function extractSlugFromPublicShortUrl(shortUrl: string): string | null {
  const raw = String(shortUrl || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    const sIndex = parts.indexOf("s");
    if (sIndex >= 0 && parts[sIndex + 1]) {
      return normalizeSlug(parts[sIndex + 1]);
    }
    const last = parts[parts.length - 1];
    return last ? normalizeSlug(last) : null;
  } catch {
    const match = raw.match(/\/s\/([a-z0-9-_]+)/i);
    return match?.[1] ? normalizeSlug(match[1]) : null;
  }
}

export function normalizeSlug(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 40);
}

export function randomSlug(size = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
