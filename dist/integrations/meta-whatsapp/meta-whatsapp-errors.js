"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappError = void 0;
exports.toPublicMetaError = toPublicMetaError;
exports.logMetaWhatsappSafe = logMetaWhatsappSafe;
const PUBLIC_MESSAGES = {
    unauthenticated: "Faça login para conectar o WhatsApp Oficial.",
    config_invalid: "A conexão com a Meta não está disponível. Fale com o suporte.",
    code_missing: "Não foi possível concluir a autorização. Tente novamente.",
    exchange_failed: "Não foi possível autorizar na Meta. Tente novamente.",
    invalid_token: "A autorização da Meta expirou ou é inválida. Tente conectar de novo.",
    persist_failed: "Não foi possível salvar a conexão. Tente novamente.",
    no_pending_connection: "Conclua o login da Meta antes de confirmar os dados.",
    not_connected: "Conecte o WhatsApp Oficial desta conta antes de enviar.",
    invalid_recipient: "Informe o número de destino com DDI, apenas dígitos. Ex.: 5551999887766",
    invalid_payload: "Os dados da mensagem não são válidos.",
    send_failed: "Não foi possível enviar a mensagem.",
    template_invalid: "Os dados do template não são válidos. Confira nome, idioma, categoria, corpo e exemplos das variáveis.",
    template_not_found: "Este template não pertence à conexão WhatsApp desta conta.",
    template_not_ready: "Este template ainda não está aprovado para envio.",
    conversation_not_found: "Conversa não encontrada nesta conta.",
    automation_invalid: "Os dados da automação não são válidos.",
    automation_not_found: "Fluxo ou regra de automação não encontrado nesta conta.",
};
class MetaWhatsappError extends Error {
    constructor(code, status) {
        super(PUBLIC_MESSAGES[code]);
        this.name = "MetaWhatsappError";
        this.code = code;
        this.status = status ?? defaultStatus(code);
    }
}
exports.MetaWhatsappError = MetaWhatsappError;
function defaultStatus(code) {
    if (code === "unauthenticated")
        return 401;
    if (code === "config_invalid" || code === "persist_failed")
        return 503;
    if (code === "exchange_failed" || code === "send_failed")
        return 424;
    if (code === "not_connected" || code === "template_not_ready")
        return 409;
    if (code === "template_not_found" || code === "conversation_not_found" || code === "automation_not_found")
        return 404;
    return 400;
}
function toPublicMetaError(error) {
    if (error instanceof MetaWhatsappError) {
        return { ok: false, error: error.message, code: error.code, status: error.status };
    }
    const message = String(error?.message || "");
    if (/sessão inválida|guest/i.test(message)) {
        return {
            ok: false,
            error: PUBLIC_MESSAGES.unauthenticated,
            code: "unauthenticated",
            status: 401,
        };
    }
    if (/configurad|META_APP|ENCRYPTION|Supabase/i.test(message)) {
        return {
            ok: false,
            error: PUBLIC_MESSAGES.config_invalid,
            code: "config_invalid",
            status: 503,
        };
    }
    return {
        ok: false,
        error: "Não foi possível concluir a conexão. Tente novamente.",
        code: "unknown",
        status: Number(error?.status) || 400,
    };
}
function logMetaWhatsappSafe(event, meta = {}) {
    console.info(`[meta-whatsapp] ${event}`, {
        ...meta,
        hasCode: meta.hasCode === true,
    });
}
