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

export function publicMetaGraphTemplateMessage(kind: MetaGraphErrorKind, status: number): string {
  if (kind === "transient") {
    return "A Meta está temporariamente indisponível. Tente de novo em instantes.";
  }
  if (status === 401) return "A autorização da Meta expirou ou é inválida. Reconecte o WhatsApp Oficial.";
  if (status === 403) return "A Meta recusou o gerenciamento de templates. Verifique a permissão da WABA.";
  if (status === 404) return "WABA ou template não encontrado na Meta.";
  if (status === 400) return "A Meta recusou o template. Confira nome, idioma, categoria, corpo e exemplos.";
  return "Não foi possível gerenciar o template na Meta.";
}
