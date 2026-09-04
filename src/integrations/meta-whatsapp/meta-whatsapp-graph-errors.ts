export type MetaGraphErrorKind = "permanent" | "transient";

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

export function classifyMetaGraphHttpStatus(status: number, timeout = false): MetaGraphErrorKind {
  if (timeout) return "transient";
  if (status === 429 || status >= 500 || status === 0) return "transient";
  return "permanent";
}

export function classifyMetaGraphError(input: {
  status: number;
  timeout?: boolean;
  graphCode?: string | number | null;
}): MetaGraphErrorKind {
  if (input.timeout) return "transient";
  const code = String(input.graphCode || "").trim();
  if (code && PERMANENT_META_CODES.has(code)) return "permanent";
  return classifyMetaGraphHttpStatus(input.status, false);
}

export function publicMetaGraphSendMessage(kind: MetaGraphErrorKind, status: number): string {
  if (kind === "transient") {
    return "A Meta está temporariamente indisponível. Tente de novo em instantes.";
  }
  if (status === 401) return "A autorização da Meta expirou ou é inválida. Reconecte o WhatsApp Oficial.";
  if (status === 403) return "A Meta recusou o envio. Verifique a permissão da WABA.";
  if (status === 404) return "Número ou recurso da Meta não encontrado.";
  return "Não foi possível enviar a mensagem.";
}

function asErrorRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Códigos Graph de rate limit (doc Meta error-handling).
 * Retry curto só aumenta o consumo da cota — não repetir na hora.
 * https://developers.facebook.com/docs/graph-api/guides/error-handling/
 */
const RATE_LIMIT_META_CODES = new Set(["4", "17", "341"]);

export function isMetaGraphRateLimitCode(code: string | number | null | undefined): boolean {
  return RATE_LIMIT_META_CODES.has(String(code ?? "").trim());
}

/** Detalhe genérico demais para exibir (não confundir com "(#4) Application request limit…"). */
function isGenericGraphDetail(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/^invalid parameter\.?$/i.test(t)) return true;
  if (/^an unexpected error/i.test(t)) return true;
  if (/^unknown\.?$/i.test(t)) return true;
  // Só o marcador de código, sem prosa útil
  if (/^\(?#\d+\)?\.?$/i.test(t)) return true;
  return false;
}

export function safePublicGraphTemplateDetail(json: unknown): string {
  const err = asErrorRecord((json as { error?: unknown } | null)?.error);
  const nested = asErrorRecord(err.error_data);
  const candidates = [err.error_user_msg, nested.details, err.message].map((item) =>
    String(item || "").replace(/\s+/g, " ").trim(),
  );
  const text = candidates.find((item) => item && item.length <= 280 && !isGenericGraphDetail(item)) || "";
  if (!text) return "";
  if (/EAA[A-Za-z0-9]+|access_token|app_secret|Bearer /i.test(text)) return "";
  return text;
}

export function publicMetaGraphTemplateMessage(
  kind: MetaGraphErrorKind,
  status: number,
  json?: unknown,
): string {
  if (kind === "transient") {
    return "A Meta está temporariamente indisponível. Tente de novo em instantes.";
  }
  if (status === 401) return "A autorização da Meta expirou ou é inválida. Reconecte o WhatsApp Oficial.";
  if (status === 403) return "A Meta recusou o gerenciamento de templates. Verifique a permissão da WABA.";
  if (status === 404) return "WABA ou template não encontrado na Meta.";
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

export function extractPublicGraphErrorCodes(json: unknown): { code: string; subcode: string } {
  const err = asErrorRecord((json as { error?: unknown } | null)?.error);
  return {
    code: String(err.code ?? "").trim(),
    subcode: String(err.error_subcode ?? "").trim(),
  };
}

function formatGraphCodeHint(json: unknown): string {
  const { code, subcode } = extractPublicGraphErrorCodes(json);
  return [code ? `código ${code}` : "", subcode ? `subcódigo ${subcode}` : ""]
    .filter(Boolean)
    .join(", ");
}

function looksLikeMetaRateLimitText(detail: string): boolean {
  return /request limit|too many calls|throttl|rate limit|limite (de|temporário)|cota/i.test(detail);
}

/**
 * Mensagem pública do upload resumable (header de template / mídia).
 * `fileBytes` evita culpar tamanho quando o arquivo já está abaixo do teto típico da Meta (~5 MB).
 */
export function publicMetaGraphMediaUploadMessage(
  json?: unknown,
  options?: { fileBytes?: number },
): string {
  const detail = safePublicGraphTemplateDetail(json);
  const { code } = extractPublicGraphErrorCodes(json);
  const codeHint = formatGraphCodeHint(json);
  const bytes = Number(options?.fileBytes || 0);
  const smallFile = Number.isFinite(bytes) && bytes > 0 && bytes < 5 * 1024 * 1024;

  if (isMetaGraphRateLimitCode(code) || looksLikeMetaRateLimitText(detail)) {
    const hint = codeHint || (code ? `código ${code}` : "código 4");
    return `A Meta limitou temporariamente as chamadas da API (${hint}). Aguarde alguns minutos e tente de novo — não é o tamanho da imagem.`;
  }

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
      ? `A Meta recusou o arquivo (${codeHint}). O tamanho está ok — tente de novo em instantes.`
      : "A Meta recusou o arquivo. O tamanho está ok — tente de novo em instantes.";
  }

  return codeHint
    ? `A Meta recusou o arquivo (${codeHint}). Se a imagem estiver grande, reduza e tente novamente.`
    : "A Meta recusou o arquivo. Reduza a imagem se ela estiver grande e tente novamente.";
}
