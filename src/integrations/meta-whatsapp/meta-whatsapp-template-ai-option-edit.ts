import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { placeholderIndexes } from "./meta-whatsapp-template-validate";

/** Limite do BODY na Cloud API / templates. */
export const META_TEMPLATE_AI_BODY_MAX = 1024;

export function normalizeEditedMetaTemplateAiOptionBody(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function assertEditedMetaTemplateAiOptionBody(raw: unknown): string {
  const text = normalizeEditedMetaTemplateAiOptionBody(raw);
  if (!text || text.length > META_TEMPLATE_AI_BODY_MAX) {
    throw new MetaWhatsappError("template_invalid");
  }
  const placeholders = placeholderIndexes(text);
  if (placeholders.some((value, index) => value !== index + 1)) {
    throw new MetaWhatsappError("template_invalid");
  }
  return text;
}

export function parseMetaTemplateAiOptionBodyOverrides(
  input: Record<string, unknown> | undefined,
): Array<{ index: number; body: string }> {
  const raw = input?.optionBodies ?? input?.option_bodies;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ index: number; body: string }> = [];
  raw.slice(0, 3).forEach((item, fallbackIndex) => {
    if (item == null || item === "") return;
    if (typeof item === "string") {
      out.push({ index: fallbackIndex, body: item });
      return;
    }
    if (typeof item === "object") {
      const row = item as { index?: unknown; body?: unknown };
      const index = Number.isInteger(Number(row.index)) ? Number(row.index) : fallbackIndex;
      if (row.body == null) return;
      out.push({ index, body: String(row.body) });
    }
  });
  return out;
}
