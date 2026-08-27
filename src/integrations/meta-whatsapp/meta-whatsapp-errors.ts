export type MetaWhatsappErrorCode =
  | "unauthenticated"
  | "config_invalid"
  | "code_missing"
  | "exchange_failed"
  | "invalid_token"
  | "persist_failed"
  | "no_pending_connection"
  | "not_connected"
  | "invalid_recipient"
  | "invalid_payload"
  | "send_failed"
  | "template_invalid"
  | "template_not_found"
  | "template_not_ready"
  | "conversation_not_found"
  | "automation_invalid"
  | "automation_not_found"
  | "invalid_pin"
  | "register_failed";

const PUBLIC_MESSAGES: Record<MetaWhatsappErrorCode, string> = {
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
  invalid_pin: "Informe um PIN de 6 dígitos para ativar o número.",
  register_failed: "Não foi possível ativar o número na Meta. Confira o PIN e tente de novo.",
};

export class MetaWhatsappError extends Error {
  readonly code: MetaWhatsappErrorCode;
  readonly status: number;

  constructor(code: MetaWhatsappErrorCode, status?: number) {
    super(PUBLIC_MESSAGES[code]);
    this.name = "MetaWhatsappError";
    this.code = code;
    this.status = status ?? defaultStatus(code);
  }
}

function defaultStatus(code: MetaWhatsappErrorCode): number {
  if (code === "unauthenticated") return 401;
  if (code === "config_invalid" || code === "persist_failed") return 503;
  if (code === "exchange_failed" || code === "send_failed" || code === "register_failed") return 424;
  if (code === "not_connected" || code === "template_not_ready") return 409;
  if (code === "template_not_found" || code === "conversation_not_found" || code === "automation_not_found") return 404;
  return 400;
}

export function toPublicMetaError(error: unknown): {
  ok: false;
  error: string;
  code: MetaWhatsappErrorCode | "unknown";
  status: number;
} {
  if (error instanceof MetaWhatsappError) {
    return { ok: false, error: error.message, code: error.code, status: error.status };
  }
  const message = String((error as { message?: string })?.message || "");
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
    status: Number((error as { status?: number })?.status) || 400,
  };
}

export function logMetaWhatsappSafe(event: string, meta: Record<string, unknown> = {}): void {
  console.info(`[meta-whatsapp] ${event}`, {
    ...meta,
    hasCode: meta.hasCode === true,
  });
}
