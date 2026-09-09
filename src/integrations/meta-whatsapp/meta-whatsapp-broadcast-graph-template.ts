import { isTemplateApprovedForSend } from "./meta-whatsapp-template.types";
import type { MappedGraphTemplate } from "./meta-whatsapp-template-graph.client";
import { normalizeTemplateLanguage } from "./meta-whatsapp-recipient";

export const GRAPH_TEMPLATE_MISSING_CODE = "132001";
export const GRAPH_TEMPLATE_MISSING_ABORT_AFTER = 5;

type GraphTemplateRow = MappedGraphTemplate;

export function shouldAbortBroadcastOnRepeatedTemplateMissing(
  graphCode: string | null | undefined,
  consecutive: number,
): boolean {
  if (String(graphCode || "").trim() !== GRAPH_TEMPLATE_MISSING_CODE) return false;
  return consecutive >= GRAPH_TEMPLATE_MISSING_ABORT_AFTER;
}

/** Usa o registro APPROVED da Graph (nome + idioma), não o cache local do Laboratório. */
export function pickApprovedGraphTemplate(
  items: Array<GraphTemplateRow | null | undefined>,
  name: string,
  preferredLanguage: string,
): GraphTemplateRow | null {
  const wantName = String(name || "").trim().toLowerCase();
  const wantLang = normalizeTemplateLanguage(preferredLanguage);
  if (!wantName || !wantLang) return null;
  const approved = items.filter((row): row is GraphTemplateRow => {
    if (!row) return false;
    if (String(row.name || "").trim().toLowerCase() !== wantName) return false;
    return isTemplateApprovedForSend(row.status);
  });
  return (
    approved.find((row) => normalizeTemplateLanguage(row.language) === wantLang) || null
  );
}
