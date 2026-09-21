export type InboxTemplateLeadLike = {
  waId?: string;
  nome?: string;
  numero?: string;
  texto?: string;
  previewText?: string;
};

export type InboxTemplateInspectLike = {
  bodyVariables?: Array<{ index: number; key?: string }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function extractTemplateBodyText(components: unknown): string {
  const list = Array.isArray(components) ? components : [];
  for (const item of list) {
    const row = asRecord(item);
    if (String(row.type || "").trim().toUpperCase() !== "BODY") continue;
    const text = String(row.text || "").trim();
    if (text) return text;
  }
  return "";
}

export function fillTemplatePlaceholders(
  body: string,
  values: Array<string | null | undefined>,
): string {
  return String(body || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (full, raw: string) => {
    const index = Number(raw);
    if (!Number.isFinite(index) || index < 1) return full;
    const value = values[index - 1];
    const text = String(value || "").trim();
    return text || full;
  });
}

export function leadValuesForInspect(
  inspect: InboxTemplateInspectLike | null | undefined,
  lead: InboxTemplateLeadLike | null | undefined,
): string[] {
  const vars = Array.isArray(inspect?.bodyVariables) ? inspect!.bodyVariables! : [];
  if (!vars.length) return [];
  const max = Math.max(...vars.map((item) => Number(item.index) || 0), 0);
  const values = Array.from({ length: max }, () => "");
  for (const item of vars) {
    const index = Number(item.index) || 0;
    if (index < 1) continue;
    const key = String(item.key || "").trim().toLowerCase();
    const text =
      key === "nome"
        ? String(lead?.nome || "Cliente")
        : key === "numero"
          ? String(lead?.numero || lead?.waId || "")
          : String(lead?.texto || lead?.nome || lead?.waId || "");
    values[index - 1] = text.slice(0, 60);
  }
  return values;
}

export function valuesFromSendComponents(components: unknown): string[] {
  const list = Array.isArray(components) ? components : [];
  for (const item of list) {
    const row = asRecord(item);
    if (String(row.type || "").trim().toLowerCase() !== "body") continue;
    const params = Array.isArray(row.parameters) ? row.parameters : [];
    return params.map((param) => String(asRecord(param).text || "").trim());
  }
  return [];
}

export function renderTemplateBodyText(input: {
  bodyText?: string | null;
  inspect?: InboxTemplateInspectLike | null;
  lead?: InboxTemplateLeadLike | null;
  sendComponents?: unknown;
}): string {
  const stored = String(input.lead?.previewText || "").trim();
  if (stored) return stored;
  const body = String(input.bodyText || "").trim();
  if (!body) return "";
  const fromSend = valuesFromSendComponents(input.sendComponents);
  const values = fromSend.length ? fromSend : leadValuesForInspect(input.inspect, input.lead);
  return fillTemplatePlaceholders(body, values).replace(/\s+/g, " ").trim();
}

export function isGenericInboxPreview(preview: string | null | undefined): boolean {
  const value = String(preview || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value === "—") return true;
  if (/^mensagem enviada\.?$/i.test(value)) return true;
  if (/^template:\s*/i.test(value)) return true;
  return false;
}

export type MetaInboxFilterCounts = {
  all: number;
  unread: number;
  open: number;
  pending: number;
  closed: number;
  mine: number;
};

export function emptyInboxFilterCounts(): MetaInboxFilterCounts {
  return { all: 0, unread: 0, open: 0, pending: 0, closed: 0, mine: 0 };
}

export function accumulateInboxFilterCounts(
  counts: MetaInboxFilterCounts,
  row: { status?: string | null; unreadCount?: number; assignedTo?: string | null },
  assignedTo?: string | null,
): void {
  counts.all += 1;
  if (Number(row.unreadCount || 0) > 0) counts.unread += 1;
  const status = String(row.status || "").trim().toLowerCase();
  if (status === "open") counts.open += 1;
  if (status === "pending") counts.pending += 1;
  if (status === "closed") counts.closed += 1;
  const mine = String(assignedTo || "").trim();
  if (mine && String(row.assignedTo || "").trim() === mine) counts.mine += 1;
}
