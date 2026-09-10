import type { MetaPortfolioAssetsPublic } from "./meta-whatsapp-portfolio.types";

export const PORTFOLIO_GRAPH_CACHE_TTL_MS = 10 * 60 * 1000;

type CachedPortfolioGraph = {
  at: number;
  assets: MetaPortfolioAssetsPublic;
};

const memory = new Map<string, CachedPortfolioGraph>();
const inflight = new Map<string, Promise<MetaPortfolioAssetsPublic>>();

export function shouldUsePortfolioGraphCache(): boolean {
  return !process.env.NODE_TEST_CONTEXT;
}

export function readCachedPortfolioGraph(
  tenantId: string,
  now = Date.now(),
): MetaPortfolioAssetsPublic | null {
  const id = String(tenantId || "").trim();
  if (!id) return null;
  const row = memory.get(id);
  if (!row) return null;
  if (now - row.at > PORTFOLIO_GRAPH_CACHE_TTL_MS) {
    memory.delete(id);
    return null;
  }
  return row.assets;
}

export function readStaleCachedPortfolioGraph(tenantId: string): MetaPortfolioAssetsPublic | null {
  const id = String(tenantId || "").trim();
  if (!id) return null;
  return memory.get(id)?.assets || null;
}

export function writeCachedPortfolioGraph(
  tenantId: string,
  assets: MetaPortfolioAssetsPublic,
  now = Date.now(),
): void {
  const id = String(tenantId || "").trim();
  if (!id) return;
  memory.set(id, { at: now, assets });
}

export function invalidateCachedPortfolioGraph(tenantId: string): void {
  const id = String(tenantId || "").trim();
  if (!id) return;
  memory.delete(id);
}

export function readPortfolioGraphInflight(
  tenantId: string,
): Promise<MetaPortfolioAssetsPublic> | null {
  const id = String(tenantId || "").trim();
  return id ? inflight.get(id) || null : null;
}

export function setPortfolioGraphInflight(
  tenantId: string,
  work: Promise<MetaPortfolioAssetsPublic>,
): void {
  const id = String(tenantId || "").trim();
  if (!id) return;
  inflight.set(id, work);
}

export function clearPortfolioGraphInflight(tenantId: string): void {
  const id = String(tenantId || "").trim();
  if (!id) return;
  inflight.delete(id);
}

export function clearPortfolioGraphCacheForTests(): void {
  memory.clear();
  inflight.clear();
}
