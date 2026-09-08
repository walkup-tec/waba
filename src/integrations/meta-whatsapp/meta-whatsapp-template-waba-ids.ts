import { readMetaAppId, readMetaAppSecret } from "./meta-config";
import { callMetaGraphJson, type MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { TemplateGraphCaller } from "./meta-whatsapp-template-graph.client";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isProbablyMessageTemplateRow(row: unknown): boolean {
  const item = asRecord(row);
  return Boolean(item.language || item.components || item.quality_score);
}

export function wabaIdsFromDebugTokenJson(json: unknown): string[] {
  const data = asRecord(json).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const granular = (data as { granular_scopes?: unknown }).granular_scopes;
  const list = Array.isArray(granular) ? granular : [];
  const ids = new Set<string>();
  for (const entry of list) {
    const row = asRecord(entry);
    const scope = String(row.scope || "");
    if (!scope.includes("whatsapp_business")) continue;
    const targets = Array.isArray(row.target_ids) ? row.target_ids : [];
    for (const raw of targets) {
      const id = String(raw || "").trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function wabaIdsFromBusinessEdgeJson(json: unknown): string[] {
  const data = asRecord(json).data;
  const list = Array.isArray(data) ? data : [];
  const ids: string[] = [];
  for (const row of list) {
    if (isProbablyMessageTemplateRow(row)) continue;
    const id = String(asRecord(row).id || "").trim();
    if (id) ids.push(id);
  }
  return ids;
}

export async function discoverTemplateWabaIds(input: {
  token: string;
  connection: Pick<MetaWhatsappConnectionRecord, "wabaId" | "metaBusinessId">;
  graph?: TemplateGraphCaller;
}): Promise<string[]> {
  const graph = input.graph || callMetaGraphJson;
  const primary = String(input.connection.wabaId || "").trim();
  const ids = new Set<string>();
  if (primary) ids.add(primary);

  const appId = readMetaAppId();
  const appSecret = readMetaAppSecret();
  if (appId && appSecret && input.token) {
    const debug = await graph({
      token: `${appId}|${appSecret}`,
      method: "GET",
      path: "debug_token",
      query: { input_token: input.token },
    });
    if (debug.ok) {
      for (const id of wabaIdsFromDebugTokenJson(debug.json)) ids.add(id);
    }
  }

  const bm = String(input.connection.metaBusinessId || "").trim();
  if (bm && bm !== primary) {
    for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"] as const) {
      const res: MetaGraphJsonResult = await graph({
        token: input.token,
        method: "GET",
        path: `${bm}/${edge}`,
        query: { fields: "id,name", limit: "100" },
      });
      if (!res.ok) continue;
      for (const id of wabaIdsFromBusinessEdgeJson(res.json)) {
        if (id !== bm) ids.add(id);
      }
    }
  }

  const ordered = [...ids].filter((id) => id && id !== bm);
  if (primary && !ordered.includes(primary)) ordered.unshift(primary);
  return ordered.length ? ordered : primary ? [primary] : [];
}
