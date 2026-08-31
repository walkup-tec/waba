"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findShortLinkBySlug = findShortLinkBySlug;
exports.createShortLinkRecord = createShortLinkRecord;
exports.incrementShortLinkClicks = incrementShortLinkClicks;
exports.getShortLinkClicksByUrl = getShortLinkClicksByUrl;
exports.extractSlugFromPublicShortUrl = extractSlugFromPublicShortUrl;
exports.normalizeSlug = normalizeSlug;
exports.randomSlug = randomSlug;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../data-path");
const STORE_FILE = (0, data_path_1.resolveDataFile)("shortener-links.json");
let storeCache = null;
let slugIndex = new Map();
function rebuildIndex(store) {
    slugIndex = new Map(store.links.filter((row) => row.slug).map((row) => [row.slug, row]));
}
async function loadStore() {
    if (storeCache)
        return storeCache;
    try {
        const raw = await promises_1.default.readFile(STORE_FILE, "utf8");
        const parsed = JSON.parse(raw.trim() || "{}");
        const links = Array.isArray(parsed?.links) ? parsed.links : [];
        storeCache = {
            links: links.map((row) => ({
                id: String(row?.id || ""),
                slug: String(row?.slug || ""),
                longUrl: String(row?.longUrl || row?.long_url || ""),
                tenantId: String(row?.tenantId || row?.tenant_id || "default"),
                createdAt: String(row?.createdAt || row?.created_at || new Date().toISOString()),
                clicks: Math.max(0, Number(row?.clicks || 0)),
            })),
        };
    }
    catch {
        storeCache = { links: [] };
    }
    rebuildIndex(storeCache);
    return storeCache;
}
async function persistStore(store) {
    await promises_1.default.mkdir(path_1.default.dirname(STORE_FILE), { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    await promises_1.default.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await promises_1.default.rename(tmp, STORE_FILE);
    storeCache = store;
    rebuildIndex(store);
}
async function findShortLinkBySlug(slug) {
    await loadStore();
    return slugIndex.get(slug) ?? null;
}
async function createShortLinkRecord(input) {
    const store = await loadStore();
    const existing = slugIndex.get(input.slug);
    if (existing) {
        if (existing.longUrl === input.longUrl)
            return existing;
        throw new Error("slug já existe para outra URL");
    }
    const record = {
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
async function incrementShortLinkClicks(slug) {
    const store = await loadStore();
    const record = slugIndex.get(slug);
    if (!record)
        return 0;
    record.clicks = Math.max(0, Number(record.clicks || 0)) + 1;
    await persistStore(store);
    return record.clicks;
}
async function getShortLinkClicksByUrl(shortUrl) {
    const slug = extractSlugFromPublicShortUrl(shortUrl);
    if (!slug)
        return null;
    const record = await findShortLinkBySlug(slug);
    if (!record)
        return null;
    return Math.max(0, Number(record.clicks || 0));
}
function extractSlugFromPublicShortUrl(shortUrl) {
    const raw = String(shortUrl || "").trim();
    if (!raw)
        return null;
    try {
        const u = new URL(raw);
        const parts = u.pathname.split("/").filter(Boolean);
        const sIndex = parts.indexOf("s");
        if (sIndex >= 0 && parts[sIndex + 1]) {
            return normalizeSlug(parts[sIndex + 1]);
        }
        const last = parts[parts.length - 1];
        return last ? normalizeSlug(last) : null;
    }
    catch {
        const match = raw.match(/\/s\/([a-z0-9-_]+)/i);
        return match?.[1] ? normalizeSlug(match[1]) : null;
    }
}
function normalizeSlug(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "")
        .slice(0, 40);
}
function randomSlug(size = 7) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < size; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}
