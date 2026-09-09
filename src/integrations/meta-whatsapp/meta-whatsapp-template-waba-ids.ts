import { readMetaAppId, readMetaAppSecret } from "./meta-config";
import { callMetaGraphJson, type MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { TemplateGraphCaller } from "./meta-whatsapp-template-graph.client";
import { knownOwnedWabaIdsForBusiness } from "./meta-whatsapp-known-owned-wabas";

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
    const scope = String(row.scope || "").trim();
    // Só management traz WABA IDs. messaging traz phone_number_id — GET /{id}/message_templates
    // nesses chips falha/demora e o Traefik devolve 502 vazio no "Atualizar da Meta".
    if (scope !== "whatsapp_business_management") continue;
    const targets = Array.isArray(row.target_ids) ? row.target_ids : [];
    for (const raw of targets) {
      const id = String(raw || "").trim();
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export function wabaIdsFromBusinessEdgeJson(json: unknown): string[] {
  return wabasFromBusinessEdgeJson(json).map((row) => row.id);
}

export function wabasFromBusinessEdgeJson(json: unknown): Array<{ id: string; name: string }> {
  const data = asRecord(json).data;
  const list = Array.isArray(data) ? data : [];
  const out: Array<{ id: string; name: string }> = [];
  for (const row of list) {
    if (isProbablyMessageTemplateRow(row)) continue;
    const rec = asRecord(row);
    const id = String(rec.id || "").trim();
    if (!id) continue;
    const name = String(rec.name || "").trim();
    out.push({ id, name: name || `WABA ${id}` });
  }
  return out;
}

function wabasFromNamedBusinessEdge(
  json: unknown,
  edge: "owned_whatsapp_business_accounts" | "client_whatsapp_business_accounts",
): Array<{ id: string; name: string }> {
  const data = asRecord(asRecord(json)[edge]).data;
  const list = Array.isArray(data) ? data : [];
  const seen = new Map<string, string>();
  for (const item of list) {
    if (isProbablyMessageTemplateRow(item)) continue;
    const rec = asRecord(item);
    const id = String(rec.id || "").trim();
    if (!id) continue;
    const name = String(rec.name || "").trim();
    if (!seen.has(id)) seen.set(id, name);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
}

export function splitWabasFromBusinessNodeJson(json: unknown): {
  owned: Array<{ id: string; name: string }>;
  client: Array<{ id: string; name: string }>;
} {
  return {
    owned: wabasFromNamedBusinessEdge(json, "owned_whatsapp_business_accounts"),
    client: wabasFromNamedBusinessEdge(json, "client_whatsapp_business_accounts"),
  };
}

/** Contas WhatsApp do BM. Padrão: só owned ("Propriedade de" no Manager). */
export function wabasFromBusinessNodeJson(
  json: unknown,
  opts?: { includeClient?: boolean },
): Array<{ id: string; name: string }> {
  const split = splitWabasFromBusinessNodeJson(json);
  if (opts?.includeClient) {
    const seen = new Map<string, string>();
    for (const row of [...split.owned, ...split.client]) {
      if (!seen.has(row.id)) seen.set(row.id, row.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
  }
  return split.owned;
}

/** Outras conexões abertas do mesmo BM — WABA02 pode não vir no owned do token ES. */
export function extraWabaIdsFromConnections(
  rows: Array<Pick<MetaWhatsappConnectionRecord, "id" | "wabaId" | "metaBusinessId">>,
  current: Pick<MetaWhatsappConnectionRecord, "id" | "wabaId" | "metaBusinessId">,
): string[] {
  const bm = String(current.metaBusinessId || "").trim();
  const selfWaba = String(current.wabaId || "").trim();
  const selfId = String(current.id || "").trim();
  const out = new Set<string>();
  for (const row of rows) {
    if (selfId && String(row.id || "").trim() === selfId) continue;
    if (bm && String(row.metaBusinessId || "").trim() !== bm) continue;
    const id = String(row.wabaId || "").trim();
    if (id && id !== selfWaba) out.add(id);
  }
  for (const id of knownOwnedWabaIdsForBusiness(bm)) {
    if (id && id !== selfWaba) out.add(id);
  }
  return [...out];
}

export function wabaIdentityMatchesBusiness(json: unknown, businessId: string): boolean {
  const wanted = String(businessId || "").trim();
  if (!wanted) return true;
  const row = asRecord(json);
  const owner = String(asRecord(row.owner_business_info).id || "").trim();
  // "Propriedade de" no Manager. on_behalf marca WABA compartilhada (client), não deste BM.
  return Boolean(owner) && owner === wanted;
}

const DISCOVER_GRAPH = { maxAttempts: 1, timeoutMs: 8000 } as const;

export async function filterWabaIdsOwnedByBusiness(input: {
  token: string;
  businessId: string;
  ids: string[];
  keepOnErrorIds?: string[];
  graph?: TemplateGraphCaller;
}): Promise<Array<{ id: string; name: string }>> {
  const graph = input.graph || callMetaGraphJson;
  const bm = String(input.businessId || "").trim();
  const unique = [...new Set((input.ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  const keepOnError = new Set(
    (input.keepOnErrorIds || []).map((id) => String(id || "").trim()).filter(Boolean),
  );
  const out: Array<{ id: string; name: string }> = [];
  const chunkSize = 8;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const rows = await Promise.all(
      slice.map(async (id) => {
        const res: MetaGraphJsonResult = await graph({
          token: input.token,
          method: "GET",
          path: id,
          query: {
            fields: "id,name,owner_business_info{id},on_behalf_of_business_info{id}",
          },
          ...DISCOVER_GRAPH,
        });
        return { id, res };
      }),
    );
    for (const { id, res } of rows) {
      if (!res.ok) {
        if (keepOnError.has(id)) out.push({ id, name: `WABA ${id}` });
        continue;
      }
      if (bm && !wabaIdentityMatchesBusiness(res.json, bm)) continue;
      const name = String((res.json as { name?: unknown } | undefined)?.name || "").trim();
      out.push({ id, name: name || `WABA ${id}` });
    }
  }
  return out;
}

function addDiscoveredWaba(
  byId: Map<string, string>,
  id: string,
  name: string,
  bm: string,
): void {
  const wid = String(id || "").trim();
  if (!wid || (bm && wid === bm)) return;
  const next = String(name || "").trim();
  const prev = byId.get(wid) || "";
  byId.set(wid, next || prev);
}

async function listBusinessWabaEdgeRows(
  graph: TemplateGraphCaller,
  token: string,
  businessId: string,
  edge: "owned_whatsapp_business_accounts" | "client_whatsapp_business_accounts",
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  const seenCursors = new Set<string>();
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const query: Record<string, string> = { fields: "id,name", limit: "100" };
    if (after) query.after = after;
    const res: MetaGraphJsonResult = await graph({
      token,
      method: "GET",
      path: `${businessId}/${edge}`,
      query,
      ...DISCOVER_GRAPH,
    });
    if (!res.ok) break;
    const batch = wabasFromBusinessEdgeJson(res.json);
    for (const row of batch) out.push(row);
    const paging = asRecord(asRecord(res.json).paging);
    const nextAfter = String(asRecord(paging.cursors).after || "").trim();
    if (!nextAfter || nextAfter === after || seenCursors.has(nextAfter) || !batch.length) break;
    seenCursors.add(nextAfter);
    after = nextAfter;
  }
  return out;
}

export async function discoverTemplateWabas(input: {
  token: string;
  connection: Pick<MetaWhatsappConnectionRecord, "wabaId" | "metaBusinessId">;
  extraWabaIds?: string[];
  graph?: TemplateGraphCaller;
}): Promise<Array<{ id: string; name: string }>> {
  const graph = input.graph || callMetaGraphJson;
  const primary = String(input.connection.wabaId || "").trim();
  const bm = String(input.connection.metaBusinessId || "").trim();
  const byId = new Map<string, string>();
  const ownedIds = new Set<string>();
  const clientIds = new Set<string>();
  const extraSet = new Set(
    [...(input.extraWabaIds || []), primary, ...knownOwnedWabaIdsForBusiness(bm)]
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );

  if (primary) addDiscoveredWaba(byId, primary, "", bm);
  for (const id of extraSet) addDiscoveredWaba(byId, id, "", bm);

  if (bm) {
    const nested: MetaGraphJsonResult = await graph({
      token: input.token,
      method: "GET",
      path: bm,
      query: {
        fields:
          "owned_whatsapp_business_accounts{id,name},client_whatsapp_business_accounts{id,name}",
      },
      ...DISCOVER_GRAPH,
    });
    if (nested.ok) {
      const split = splitWabasFromBusinessNodeJson(nested.json);
      for (const row of split.owned) {
        ownedIds.add(row.id);
        addDiscoveredWaba(byId, row.id, row.name, bm);
      }
      for (const row of split.client) clientIds.add(row.id);
    }
    for (const row of await listBusinessWabaEdgeRows(
      graph,
      input.token,
      bm,
      "owned_whatsapp_business_accounts",
    )) {
      ownedIds.add(row.id);
      addDiscoveredWaba(byId, row.id, row.name, bm);
    }
    for (const row of await listBusinessWabaEdgeRows(
      graph,
      input.token,
      bm,
      "client_whatsapp_business_accounts",
    )) {
      clientIds.add(row.id);
    }
  }

  const appId = readMetaAppId();
  const appSecret = readMetaAppSecret();
  if (appId && appSecret && input.token) {
    const debug = await graph({
      token: `${appId}|${appSecret}`,
      method: "GET",
      path: "debug_token",
      query: { input_token: input.token },
      ...DISCOVER_GRAPH,
    });
    if (debug.ok) {
      for (const id of wabaIdsFromDebugTokenJson(debug.json)) {
        addDiscoveredWaba(byId, id, "", bm);
      }
    }
  }

  // WABA client (ex.: Rio de Janeiro 01) não entra no picker deste BM, mesmo se GET owner bater.
  for (const id of [...byId.keys()]) {
    if (clientIds.has(id) && !ownedIds.has(id) && !extraSet.has(id)) byId.delete(id);
  }

  const candidateIds = [...byId.keys()];
  // debug_token lista WABAs de outros BMs. Sem edge client, GET 403 não pode preservar esses IDs.
  const keepOnErrorIds = candidateIds.filter((id) => ownedIds.has(id) || extraSet.has(id));
  if (bm && candidateIds.length) {
    const owned = await filterWabaIdsOwnedByBusiness({
      token: input.token,
      businessId: bm,
      ids: candidateIds,
      keepOnErrorIds,
      graph,
    });
    const verified = new Map<string, string>();
    for (const row of owned) {
      addDiscoveredWaba(verified, row.id, row.name || byId.get(row.id) || "", bm);
    }
    return [...verified.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
  }

  return [...byId.entries()].map(([id, name]) => ({ id, name: name || `WABA ${id}` }));
}

export async function discoverTemplateWabaIds(input: {
  token: string;
  connection: Pick<MetaWhatsappConnectionRecord, "wabaId" | "metaBusinessId">;
  extraWabaIds?: string[];
  graph?: TemplateGraphCaller;
}): Promise<string[]> {
  return (await discoverTemplateWabas(input)).map((row) => row.id);
}
