"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumableUploadTimeoutMs = resumableUploadTimeoutMs;
exports.uploadMetaResumableImage = uploadMetaResumableImage;
exports.publishMetaPageProfilePicture = publishMetaPageProfilePicture;
const meta_config_1 = require("./meta-config");
const meta_whatsapp_graph_client_1 = require("./meta-whatsapp-graph.client");
const meta_whatsapp_graph_errors_1 = require("./meta-whatsapp-graph-errors");
function resumableUploadTimeoutMs(mime, override) {
    if (Number.isFinite(override) && Number(override) > 0)
        return Math.floor(Number(override));
    const type = String(mime || "").toLowerCase();
    if (type.includes("video"))
        return 300000;
    if (type.includes("pdf") || type.includes("document"))
        return 180000;
    return 60000;
}
function toUploadSessionPath(id) {
    const raw = String(id || "").trim();
    if (!raw)
        return "";
    return raw.startsWith("upload:") ? raw : `upload:${raw}`;
}
function normalizeUploadMime(mime) {
    const raw = String(mime || "").trim().toLowerCase().split(";")[0].trim();
    if (raw === "image/jpg" || raw === "image/pjpeg")
        return "image/jpeg";
    if (raw === "image/x-png")
        return "image/png";
    return raw;
}
function sanitizeUploadName(fileName, mime) {
    const type = normalizeUploadMime(mime);
    const ext = type === "image/png" ? "png" : type === "video/mp4" ? "mp4" : type === "application/pdf" ? "pdf" : "jpg";
    return `header.${ext}`;
}
async function uploadMetaResumableImage(input) {
    const token = String(input.token || "").trim();
    const appId = String(input.appId || "").trim();
    if (!token || !appId)
        throw new Error("Upload da Meta sem app ou token.");
    if (!input.bytes?.length)
        throw new Error("A Meta recusou o arquivo. Arquivo vazio.");
    const started = await (0, meta_whatsapp_graph_client_1.callMetaGraphJson)({
        token,
        method: "POST",
        path: `${appId}/uploads`,
        query: {
            file_name: sanitizeUploadName(input.fileName, input.mime),
            file_length: String(input.bytes.length),
            file_type: normalizeUploadMime(input.mime),
        },
    });
    const sessionId = toUploadSessionPath(String(started.json?.id || "").trim());
    if (!started.ok || !sessionId) {
        if (started.timeout) {
            throw new Error("A Meta recusou o arquivo. Tempo esgotado ao abrir a sessão de upload.");
        }
        throw new Error((0, meta_whatsapp_graph_errors_1.publicMetaGraphMediaUploadMessage)(started.json, { fileBytes: input.bytes.length }));
    }
    const url = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${sessionId}`;
    const controller = new AbortController();
    const timeoutMs = resumableUploadTimeoutMs(input.mime, input.timeoutMs);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        // Cópia em ArrayBuffer próprio — evita Buffer pooled / tipagem BodyInit opaca no fetch.
        const body = new Uint8Array(input.bytes);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `OAuth ${token}`,
                file_offset: "0",
                "Content-Type": "application/octet-stream",
            },
            body,
            signal: controller.signal,
        });
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
            json = null;
        }
        const handle = String(json?.h || "").trim();
        if (!response.ok || !handle) {
            throw new Error((0, meta_whatsapp_graph_errors_1.publicMetaGraphMediaUploadMessage)(json, { fileBytes: input.bytes.length }));
        }
        return { handle };
    }
    catch (error) {
        if (String(error?.name || "") === "AbortError") {
            throw new Error("A Meta recusou o arquivo. O upload do vídeo passou do tempo limite. Use MP4 até 16 MB (H.264) e tente de novo.");
        }
        const nested = String(error?.cause?.message ||
            error?.cause?.code ||
            error?.message ||
            "")
            .replace(/\s+/g, " ")
            .trim();
        if (nested && !/^A Meta recusou/i.test(nested)) {
            throw new Error(`A Meta recusou o arquivo. ${nested}`.slice(0, 280));
        }
        throw error;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
async function publishMetaPageProfilePicture(input) {
    const token = String(input.token || "").trim();
    const pageId = String(input.pageId || "").trim();
    if (!token || !pageId)
        throw new Error("Upload da foto da página sem id ou token.");
    const url = `${(0, meta_config_1.readMetaGraphBase)()}/${(0, meta_config_1.readMetaGraphVersion)()}/${pageId}/photos`;
    const form = new FormData();
    form.append("published", "true");
    form.append("source", new Blob([new Uint8Array(input.bytes)], { type: input.mime }), input.fileName);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
            signal: controller.signal,
        });
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        }
        catch {
            json = null;
        }
        const photoId = String(json?.id || "").trim();
        if (!response.ok || !photoId) {
            const graphCode = String(json?.error?.code || "").trim();
            throw new Error(graphCode ? `page-photo ${response.status} ${graphCode}` : "A Meta não publicou a foto na página.");
        }
        const pictured = await (0, meta_whatsapp_graph_client_1.callMetaGraphJson)({
            token,
            method: "POST",
            path: `${pageId}/picture`,
            body: { photo: photoId },
        });
        if (!pictured.ok) {
            throw new Error("A Meta não definiu a foto de perfil da página.");
        }
        return { photoId };
    }
    finally {
        clearTimeout(timeoutId);
    }
}
