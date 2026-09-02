import { callMetaGraphJson, type MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import type { MetaGraphTemplate } from "./meta-whatsapp-template.types";
import { qualityScoreFromGraph } from "./meta-whatsapp-template.types";

const LIST_FIELDS = "id,name,language,status,category,quality_score,rejected_reason,components";
const MAX_PAGES = 20;

export type TemplateGraphCaller = (input: {
  token: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}) => Promise<MetaGraphJsonResult>;

export function mapGraphTemplate(raw: MetaGraphTemplate): {
  metaTemplateId: string | null;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  qualityScore: string | null;
  rejectedReason: string | null;
  components: unknown;
} | null {
  const name = String(raw.name || "").trim();
  const language = String(raw.language || "").trim();
  if (!name || !language) return null;
  return {
    metaTemplateId: raw.id ? String(raw.id) : null,
    name,
    language,
    category: raw.category ? String(raw.category) : null,
    status: raw.status ? String(raw.status) : null,
    qualityScore: qualityScoreFromGraph(raw.quality_score),
    rejectedReason: raw.rejected_reason ? String(raw.rejected_reason) : null,
    components: raw.components ?? null,
  };
}

export async function listWabaMessageTemplates(input: {
  token: string;
  wabaId: string;
  graph?: TemplateGraphCaller;
}): Promise<
  | { ok: true; items: ReturnType<typeof mapGraphTemplate>[]; pages: number; complete: boolean }
  | { ok: false; result: MetaGraphJsonResult }
> {
  const graph = input.graph || callMetaGraphJson;
  const items: ReturnType<typeof mapGraphTemplate>[] = [];
  const seenCursors = new Set<string>();
  let after = "";
  let pages = 0;
  let complete = true;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query: Record<string, string> = {
      fields: LIST_FIELDS,
      limit: "50",
    };
    if (after) query.after = after;
    const result = await graph({
      token: input.token,
      method: "GET",
      path: `${input.wabaId}/message_templates`,
      query,
    });
    if (!result.ok) return { ok: false, result };
    pages += 1;
    const data = Array.isArray(result.json?.data) ? result.json.data : [];
    for (const row of data) {
      items.push(mapGraphTemplate(row as MetaGraphTemplate));
    }
    const nextAfter = String(result.json?.paging?.cursors?.after || "").trim();
    if (!nextAfter || nextAfter === after || seenCursors.has(nextAfter) || !data.length) {
      break;
    }
    seenCursors.add(nextAfter);
    after = nextAfter;
    if (page === MAX_PAGES - 1) complete = false;
  }

  return { ok: true, items, pages, complete };
}

export async function deleteWabaMessageTemplate(input: {
  token: string;
  wabaId: string;
  name: string;
  metaTemplateId?: string | null;
  graph?: TemplateGraphCaller;
}): Promise<MetaGraphJsonResult> {
  const graph = input.graph || callMetaGraphJson;
  const query: Record<string, string> = { name: String(input.name || "").trim() };
  const metaId = String(input.metaTemplateId || "").trim();
  if (metaId) query.hsm_id = metaId;
  return graph({
    token: input.token,
    method: "DELETE",
    path: `${input.wabaId}/message_templates`,
    query,
  });
}

export async function createWabaMessageTemplate(input: {
  token: string;
  wabaId: string;
  body: Record<string, unknown>;
  graph?: TemplateGraphCaller;
}): Promise<MetaGraphJsonResult> {
  const graph = input.graph || callMetaGraphJson;
  return graph({
    token: input.token,
    method: "POST",
    path: `${input.wabaId}/message_templates`,
    body: input.body,
  });
}
