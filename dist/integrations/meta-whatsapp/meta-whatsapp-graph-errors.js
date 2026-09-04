"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyMetaGraphHttpStatus = classifyMetaGraphHttpStatus;
exports.classifyMetaGraphError = classifyMetaGraphError;
exports.publicMetaGraphSendMessage = publicMetaGraphSendMessage;
exports.safePublicGraphTemplateDetail = safePublicGraphTemplateDetail;
exports.publicMetaGraphTemplateMessage = publicMetaGraphTemplateMessage;
exports.extractPublicGraphErrorCodes = extractPublicGraphErrorCodes;
exports.publicMetaGraphMediaUploadMessage = publicMetaGraphMediaUploadMessage;
const PERMANENT_META_CODES = new Set([
    "100",
    "190",
    "200",
    "10",
    "131026",
    "131047",
    "131051",
    "132000",
    "132001",
    "132005",
    "132007",
    "132012",
    "133010",
]);
function classifyMetaGraphHttpStatus(status, timeout = false) {
    if (timeout)
        return "transient";
    if (status === 429 || status >= 500 || status === 0)
        return "transient";
    return "permanent";
}
function classifyMetaGraphError(input) {
    if (input.timeout)
        return "transient";
    const code = String(input.graphCode || "").trim();
    if (code && PERMANENT_META_CODES.has(code))
        return "permanent";
    return classifyMetaGraphHttpStatus(input.status, false);
}
function publicMetaGraphSendMessage(kind, status) {
    if (kind === "transient") {
        return "A Meta está temporariamente indisponível. Tente de novo em instantes.";
    }
    if (status === 401)
        return "A autorização da Meta expirou ou é inválida. Reconecte o WhatsApp Oficial.";
    if (status === 403)
        return "A Meta recusou o envio. Verifique a permissão da WABA.";
    if (status === 404)
        return "Número ou recurso da Meta não encontrado.";
    return "Não foi possível enviar a mensagem.";
}
function asErrorRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function safePublicGraphTemplateDetail(json) {
    const err = asErrorRecord(json?.error);
    const nested = asErrorRecord(err.error_data);
    const candidates = [err.error_user_msg, nested.details, err.message].map((item) => String(item || "").replace(/\s+/g, " ").trim());
    const generic = /invalid parameter|^an unexpected error|^unknown|#\d+/i;
    const text = candidates.find((item) => item && item.length <= 280 && !generic.test(item)) || "";
    if (!text)
        return "";
    if (/EAA[A-Za-z0-9]+|access_token|app_secret|Bearer /i.test(text))
        return "";
    return text;
}
function publicMetaGraphTemplateMessage(kind, status, json) {
    if (kind === "transient") {
        return "A Meta está temporariamente indisponível. Tente de novo em instantes.";
    }
    if (status === 401)
        return "A autorização da Meta expirou ou é inválida. Reconecte o WhatsApp Oficial.";
    if (status === 403)
        return "A Meta recusou o gerenciamento de templates. Verifique a permissão da WABA.";
    if (status === 404)
        return "WABA ou template não encontrado na Meta.";
    const detail = safePublicGraphTemplateDetail(json);
    if (status === 400) {
        if (/wa\.me|whatsapp\.com|whatsapp\.net/i.test(detail)) {
            return "A Meta não aceita wa.me, whatsapp.com nem whatsapp.net no botão URL. Use o site https do seu atendimento ou retorno.";
        }
        return detail
            ? `A Meta recusou o template. ${detail}`
            : "A Meta recusou o template. Confira nome, idioma, categoria, corpo e exemplos.";
    }
    return detail || "Não foi possível gerenciar o template na Meta.";
}
function extractPublicGraphErrorCodes(json) {
    const err = asErrorRecord(json?.error);
    return {
        code: String(err.code ?? "").trim(),
        subcode: String(err.error_subcode ?? "").trim(),
    };
}
function formatGraphCodeHint(json) {
    const { code, subcode } = extractPublicGraphErrorCodes(json);
    return [code ? `código ${code}` : "", subcode ? `subcódigo ${subcode}` : ""]
        .filter(Boolean)
        .join(", ");
}
/**
 * Mensagem pública do upload resumable (header de template / mídia).
 * `fileBytes` evita culpar tamanho quando o arquivo já está abaixo do teto típico da Meta (~5 MB).
 */
function publicMetaGraphMediaUploadMessage(json, options) {
    const detail = safePublicGraphTemplateDetail(json);
    const codeHint = formatGraphCodeHint(json);
    const bytes = Number(options?.fileBytes || 0);
    const smallFile = Number.isFinite(bytes) && bytes > 0 && bytes < 5 * 1024 * 1024;
    if (detail) {
        if (/size|too large|file length|maximum|tamanho|\b\d+\s*MB\b/i.test(detail)) {
            return `A Meta recusou o arquivo por tamanho. ${detail} Reduza a imagem e envie de novo.`;
        }
        return codeHint
            ? `A Meta recusou o arquivo. ${detail} (${codeHint}).`
            : `A Meta recusou o arquivo. ${detail}`;
    }
    if (smallFile) {
        return codeHint
            ? `A Meta recusou o arquivo (${codeHint}). O tamanho está ok — reconecte o WhatsApp Oficial ou tente de novo em instantes.`
            : "A Meta recusou o arquivo. O tamanho está ok — reconecte o WhatsApp Oficial ou tente de novo em instantes.";
    }
    return codeHint
        ? `A Meta recusou o arquivo (${codeHint}). Se a imagem estiver grande, reduza e tente novamente.`
        : "A Meta recusou o arquivo. Reduza a imagem se ela estiver grande e tente novamente.";
}
