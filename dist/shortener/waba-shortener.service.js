"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.peekWabaShortPublicBaseUrl = void 0;
exports.createWabaShortUrl = createWabaShortUrl;
exports.resolveWabaShortRedirect = resolveWabaShortRedirect;
exports.fetchWabaShortUrlClicks = fetchWabaShortUrlClicks;
exports.isWabaManagedShortUrl = isWabaManagedShortUrl;
const crypto_1 = __importDefault(require("crypto"));
const waba_public_base_url_1 = require("../lib/waba-public-base-url");
Object.defineProperty(exports, "peekWabaShortPublicBaseUrl", { enumerable: true, get: function () { return waba_public_base_url_1.peekWabaShortPublicBaseUrl; } });
const waba_shortener_repository_1 = require("./waba-shortener.repository");
function buildPublicShortUrl(slug, hints) {
    (0, waba_public_base_url_1.rememberPublicBaseFromRequest)(hints);
    const base = (0, waba_public_base_url_1.resolveWabaShortPublicBaseUrl)(hints);
    return `${base}/s/${slug}`;
}
function deriveSlugFromLongUrl(longUrl) {
    const nonceMatch = longUrl.match(/_n8n_link_nonce=([^&]+)/i) ||
        longUrl.match(/_n8n_test_nonce=([^&]+)/i);
    const rawNonce = String(nonceMatch?.[1] || "").trim();
    const clean = rawNonce.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (clean)
        return (0, waba_shortener_repository_1.normalizeSlug)(`n${clean.slice(-7)}`);
    return (0, waba_shortener_repository_1.randomSlug)(7);
}
async function createWabaShortUrl(longUrl, options = {}) {
    const safeLongUrl = String(longUrl || "").trim();
    if (!/^https?:\/\//i.test(safeLongUrl)) {
        throw new Error("URL original é obrigatória.");
    }
    let slug = (0, waba_shortener_repository_1.normalizeSlug)(options.slug || "");
    if (!slug)
        slug = deriveSlugFromLongUrl(safeLongUrl);
    const maxAttempts = 5;
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidateSlug = attempt === 0 ? slug : (0, waba_shortener_repository_1.randomSlug)(7);
        try {
            const record = await (0, waba_shortener_repository_1.createShortLinkRecord)({
                id: crypto_1.default.randomUUID(),
                slug: candidateSlug,
                longUrl: safeLongUrl,
                tenantId: options.tenantId,
            });
            return buildPublicShortUrl(record.slug, options.publicBaseHints);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error?.message || "Falha ao criar slug"));
        }
    }
    throw lastError || new Error("Falha ao gerar link curto WABA.");
}
async function resolveWabaShortRedirect(slug) {
    const normalized = (0, waba_shortener_repository_1.normalizeSlug)(slug);
    if (!normalized)
        return null;
    const record = await (0, waba_shortener_repository_1.findShortLinkBySlug)(normalized);
    if (!record?.longUrl)
        return null;
    await (0, waba_shortener_repository_1.incrementShortLinkClicks)(normalized);
    return record.longUrl;
}
async function fetchWabaShortUrlClicks(shortUrl) {
    if (!(0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(shortUrl))
        return null;
    return (0, waba_shortener_repository_1.getShortLinkClicksByUrl)(shortUrl);
}
function isWabaManagedShortUrl(shortUrl) {
    const slug = (0, waba_shortener_repository_1.extractSlugFromPublicShortUrl)(shortUrl);
    if (!slug)
        return false;
    const peek = (0, waba_public_base_url_1.peekWabaShortPublicBaseUrl)();
    const base = String(peek.base || "").toLowerCase();
    if (!base)
        return String(shortUrl || "").toLowerCase().includes("/s/");
    try {
        const u = new URL(String(shortUrl || "").trim());
        const shortBase = new URL(base);
        return u.hostname === shortBase.hostname;
    }
    catch {
        return String(shortUrl || "").toLowerCase().includes("/s/");
    }
}
