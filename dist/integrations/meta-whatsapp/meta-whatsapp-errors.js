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
    template_url_https: "Informe a URL do botão com http:// ou https://.",
    template_url_restricted: "A Meta recusou o endereço do botão. Confira o link e tente novamente.",
    template_shorten_failed: "Não foi possível cadastrar o botão. Tente novamente em instantes.",
    template_media_required: "Selecione o arquivo da mídia. A Meta exige um exemplo via upload para cabeçalho de imagem, vídeo ou documento.",
    template_media_too_large: "A Meta recusou a mídia do cabeçalho por tamanho. Envie um JPEG ou PNG menor.",
    template_upload_failed: "A Meta recusou o arquivo. Se for por tamanho, reduza a imagem e tente novamente.",
    template_not_found: "Este template não pertence à conexão WhatsApp desta conta.",
    template_delete_failed: "Não foi possível excluir o template na Meta. Tente novamente.",
    template_not_ready: "Este template ainda não está aprovado para envio.",
    conversation_not_found: "Conversa não encontrada nesta conta.",
    automation_invalid: "Os dados da automação não são válidos.",
    automation_not_found: "Fluxo ou regra de automação não encontrado nesta conta.",
    invalid_pin: "Informe um PIN de 6 dígitos para ativar o número.",
    register_failed: "Não foi possível ativar o número na Meta. Confira o PIN e tente de novo.",
    profile_update_failed: "Não foi possível atualizar o nome ou a foto deste número na Meta.",
    phone_not_registered: "Ative o número com o PIN de 6 dígitos antes de mudar nome ou foto. O cliente do disparo só vê o que a Meta já aplicou.",
    portfolio_update_failed: "Não foi possível atualizar o nome ou a foto deste portfólio na Meta.",
    portfolio_photo_no_page: "A Meta não deixa gravar a foto no Business Manager. Este portfólio ainda não tem uma Página do Facebook. Ligue uma página principal ou altere só o nome.",
    template_ai_unavailable: "O Assistente de Templates está temporariamente indisponível.",
    template_ai_rate_limited: "Limite de análises por IA atingido. Aguarde um minuto e tente novamente.",
    template_ai_invalid_output: "A IA não conseguiu gerar opções seguras e válidas. Revise o texto base e tente novamente.",
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
    if (code === "template_ai_rate_limited")
        return 429;
    if (code === "template_ai_unavailable")
        return 503;
    if (code === "template_ai_invalid_output")
        return 422;
    if (code === "config_invalid" || code === "persist_failed")
        return 503;
    if (code === "exchange_failed" ||
        code === "send_failed" ||
        code === "template_delete_failed" ||
        code === "register_failed" ||
        code === "profile_update_failed" ||
        code === "portfolio_update_failed") {
        return 424;
    }
    if (code === "portfolio_photo_no_page" || code === "phone_not_registered")
        return 409;
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
    const row = error && typeof error === "object" ? error : null;
    const duckCode = String(row?.code || "").trim();
    if (duckCode && duckCode in PUBLIC_MESSAGES) {
        return {
            ok: false,
            error: String(row?.message || PUBLIC_MESSAGES[duckCode]),
            code: duckCode,
            status: Number(row?.status) || defaultStatus(duckCode),
        };
    }
    const name = String(row?.name || "").trim();
    const message = collectErrorText(error);
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
    if (/^A Meta recusou|^Selecione o arquivo|^Informe |^Não foi possível |^O upload /i.test(message)) {
        return {
            ok: false,
            error: message.slice(0, 400),
            code: "template_upload_failed",
            status: 400,
        };
    }
    if (name === "AbortError" ||
        name === "TimeoutError" ||
        /aborted|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up|Fetch failed|UND_ERR|network/i.test(message)) {
        return {
            ok: false,
            error: "O upload da mídia demorou demais ou a conexão caiu. Use um MP4 menor (até 16 MB, H.264) e tente de novo.",
            code: "template_upload_failed",
            status: 400,
        };
    }
    if (message) {
        return {
            ok: false,
            error: `Não foi possível enviar a mídia. ${message}`.slice(0, 400),
            code: "template_upload_failed",
            status: Number(row?.status) || 400,
        };
    }
    return {
        ok: false,
        error: "Não foi possível enviar a mídia do cabeçalho. Use MP4 H.264 até 16 MB e tente de novo. Se repetir, fale com o suporte.",
        code: "template_upload_failed",
        status: Number(row?.status) || 400,
    };
}
/** Junta message/name/code + cause (undici guarda o detalhe em error.cause). */
function collectErrorText(error) {
    const parts = [];
    let current = error;
    for (let depth = 0; depth < 5 && current; depth += 1) {
        if (typeof current === "string") {
            const text = current.trim();
            if (text)
                parts.push(text);
            break;
        }
        if (typeof current !== "object")
            break;
        const row = current;
        for (const key of ["name", "code", "message"]) {
            const value = String(row[key] || "").trim();
            if (value)
                parts.push(value);
        }
        current = row.cause;
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
}
function logMetaWhatsappSafe(event, meta = {}) {
    console.info(`[meta-whatsapp] ${event}`, {
        ...meta,
        hasCode: meta.hasCode === true,
    });
}
