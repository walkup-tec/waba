"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORTFOLIO_GRAPH_CACHE_TTL_MS = void 0;
exports.shouldUsePortfolioGraphCache = shouldUsePortfolioGraphCache;
exports.readCachedPortfolioGraph = readCachedPortfolioGraph;
exports.readStaleCachedPortfolioGraph = readStaleCachedPortfolioGraph;
exports.writeCachedPortfolioGraph = writeCachedPortfolioGraph;
exports.invalidateCachedPortfolioGraph = invalidateCachedPortfolioGraph;
exports.readPortfolioGraphInflight = readPortfolioGraphInflight;
exports.setPortfolioGraphInflight = setPortfolioGraphInflight;
exports.clearPortfolioGraphInflight = clearPortfolioGraphInflight;
exports.clearPortfolioGraphCacheForTests = clearPortfolioGraphCacheForTests;
exports.PORTFOLIO_GRAPH_CACHE_TTL_MS = 10 * 60 * 1000;
const memory = new Map();
const inflight = new Map();
function shouldUsePortfolioGraphCache() {
    return !process.env.NODE_TEST_CONTEXT;
}
function readCachedPortfolioGraph(tenantId, now = Date.now()) {
    const id = String(tenantId || "").trim();
    if (!id)
        return null;
    const row = memory.get(id);
    if (!row)
        return null;
    if (now - row.at > exports.PORTFOLIO_GRAPH_CACHE_TTL_MS) {
        memory.delete(id);
        return null;
    }
    return row.assets;
}
function readStaleCachedPortfolioGraph(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return null;
    return memory.get(id)?.assets || null;
}
function writeCachedPortfolioGraph(tenantId, assets, now = Date.now()) {
    const id = String(tenantId || "").trim();
    if (!id)
        return;
    memory.set(id, { at: now, assets });
}
function invalidateCachedPortfolioGraph(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return;
    memory.delete(id);
}
function readPortfolioGraphInflight(tenantId) {
    const id = String(tenantId || "").trim();
    return id ? inflight.get(id) || null : null;
}
function setPortfolioGraphInflight(tenantId, work) {
    const id = String(tenantId || "").trim();
    if (!id)
        return;
    inflight.set(id, work);
}
function clearPortfolioGraphInflight(tenantId) {
    const id = String(tenantId || "").trim();
    if (!id)
        return;
    inflight.delete(id);
}
function clearPortfolioGraphCacheForTests() {
    memory.clear();
    inflight.clear();
}
