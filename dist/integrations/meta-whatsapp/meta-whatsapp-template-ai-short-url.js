"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMetaTemplateDestinationUrl = normalizeMetaTemplateDestinationUrl;
exports.appendDisparosLinkNonce = appendDisparosLinkNonce;
exports.assertMetaReadyButtonShortUrl = assertMetaReadyButtonShortUrl;
exports.createMetaTemplateButtonShortUrl = createMetaTemplateButtonShortUrl;
const waba_shortener_service_1 = require("../../shortener/waba-shortener.service");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_template_validate_1 = require("./meta-whatsapp-template-validate");
/** Mesma normalização da URL de resposta da campanha (API Alternativa). */
function normalizeMetaTemplateDestinationUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed)
        return "";
    if (/^https?:\/\//i.test(trimmed))
        return trimmed.slice(0, 2000);
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed))
        return "";
    return `https://${trimmed.replace(/^\/+/, "")}`.slice(0, 2000);
}
function appendDisparosLinkNonce(destinationUrl, nonce) {
    const base = normalizeMetaTemplateDestinationUrl(destinationUrl);
    try {
        const parsed = new URL(base);
        parsed.searchParams.set("_n8n_link_nonce", nonce);
        return parsed.toString();
    }
    catch {
        const sep = base.includes("?") ? "&" : "?";
        return `${base}${sep}_n8n_link_nonce=${encodeURIComponent(nonce)}`;
    }
}
function assertMetaReadyButtonShortUrl(shortUrl) {
    const url = String(shortUrl || "").trim();
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    }
    if (parsed.protocol !== "https:")
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    if ((0, meta_whatsapp_template_validate_1.isMetaRestrictedTemplateButtonHost)(parsed.hostname)) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_restricted");
    }
    if (!/\/s\/[a-z0-9][a-z0-9-_]{2,39}/i.test(parsed.pathname)) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_shorten_failed");
    }
    return url;
}
async function createMetaTemplateButtonShortUrl(input) {
    const destination = normalizeMetaTemplateDestinationUrl(input.destinationUrl);
    if (!destination || !/^https?:\/\//i.test(destination)) {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_url_https");
    }
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const longUrl = appendDisparosLinkNonce(destination, nonce);
    try {
        const shortUrl = await (0, waba_shortener_service_1.createWabaShortUrl)(longUrl, {
            tenantId: String(input.tenantId || "").trim() || "meta-template",
            publicBaseHints: input.publicBaseHints,
        });
        return assertMetaReadyButtonShortUrl(shortUrl);
    }
    catch (error) {
        if (error instanceof meta_whatsapp_errors_1.MetaWhatsappError)
            throw error;
        throw new meta_whatsapp_errors_1.MetaWhatsappError("template_shorten_failed");
    }
}
