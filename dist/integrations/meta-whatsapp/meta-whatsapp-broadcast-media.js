"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCloudApiMedia = uploadCloudApiMedia;
const meta_config_1 = require("./meta-config");
/**
 * Upload de mídia para envio de template (header IMAGE/VIDEO/DOCUMENT).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
 */
async function uploadCloudApiMedia(input) {
    const token = String(input.token || "").trim();
    const phoneNumberId = String(input.phoneNumberId || "").trim();
    const mime = String(input.mime || "image/jpeg").trim() || "image/jpeg";
    if (!token || !phoneNumberId || !input.bytes?.length)
        return null;
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([new Uint8Array(input.bytes)], { type: mime }), String(input.fileName || "header.jpg"));
    const url = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${encodeURIComponent(phoneNumberId)}/media`;
    const fetchFn = input.fetchImpl || fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetchFn(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
            signal: controller.signal,
        });
        const json = (await response.json().catch(() => null));
        const id = String(json?.id || "").trim();
        if (!response.ok || !id)
            return null;
        return id;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
