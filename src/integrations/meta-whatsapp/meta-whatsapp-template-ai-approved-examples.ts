import type { MetaTemplateRecord } from "./meta-whatsapp-template.types";

export type MetaUtilityApprovedExample = {
  name: string;
  language: string;
  body: string;
  buttonText: string;
};

const MAX_EXAMPLES = 8;
const MAX_BODY = 500;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bodyFromComponents(components: unknown): string {
  if (!Array.isArray(components)) return "";
  for (const item of components) {
    const row = asRecord(item);
    if (String(row.type || "").trim().toUpperCase() !== "BODY") continue;
    return String(row.text || "").trim().slice(0, MAX_BODY);
  }
  return "";
}

function buttonFromComponents(components: unknown): string {
  if (!Array.isArray(components)) return "";
  for (const item of components) {
    const row = asRecord(item);
    if (String(row.type || "").trim().toUpperCase() !== "BUTTONS") continue;
    const buttons = Array.isArray(row.buttons) ? row.buttons : [];
    const first = asRecord(buttons[0]);
    return String(first.text || "").trim().slice(0, 25);
  }
  return "";
}

function isApprovedUtility(row: MetaTemplateRecord): boolean {
  return (
    String(row.status || "").trim().toUpperCase() === "APPROVED" &&
    String(row.category || "").trim().toUpperCase() === "UTILITY"
  );
}

function sortKey(row: MetaTemplateRecord): string {
  return String(row.lastSyncedAt || row.updatedAt || row.createdAt || "");
}

export function pickApprovedUtilityExamples(
  rows: MetaTemplateRecord[],
  limit = MAX_EXAMPLES,
): MetaUtilityApprovedExample[] {
  return [...rows]
    .filter(isApprovedUtility)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .map((row) => ({
      name: String(row.name || "").trim(),
      language: String(row.language || "").trim() || "pt_BR",
      body: bodyFromComponents(row.components),
      buttonText: buttonFromComponents(row.components),
    }))
    .filter((item) => item.name && item.body)
    .slice(0, Math.max(1, Math.min(12, limit)));
}
