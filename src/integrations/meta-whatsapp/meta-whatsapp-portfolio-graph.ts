import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import {
  mapMetaBusinessToPortfolio,
  mapMetaWabaIdentity,
  mergePortfolioIdentity,
  listMetaBusinessNodes,
  firstOwnedPageId,
  META_OWNED_PAGES_FIELDS,
  type MetaWabaIdentityHint,
} from "./meta-whatsapp-portfolio.map";
import type { MetaPortfolioPublic } from "./meta-whatsapp-portfolio.types";

/** IDs oficiais no Business Manager — só entram no card se a Graph devolver o objeto. */
export const META_PORTFOLIO_BUSINESS_IDS = [
  "1041827648719609",
  "4141369862822598",
] as const;

export const META_WABA_OWNER_FIELDS = "id,name,owner_business_info,on_behalf_of_business_info";
export const META_BUSINESS_NAME_FIELDS = "id,name";
export const META_BUSINESS_PAGE_FIELDS = "primary_page{id,name}";
export const META_BUSINESS_PHOTO_FIELDS = "profile_picture_uri";

export type PortfolioGraphCaller = (input: {
  token: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
}) => Promise<MetaGraphJsonResult>;

const emptyHint: MetaWabaIdentityHint = {
  wabaId: null,
  wabaName: null,
  businessId: null,
  businessName: null,
  primaryPageId: null,
  primaryPageName: null,
  profilePictureUrl: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  const raw = String(value || "").trim();
  return raw || null;
}

export function isWabaGraphNode(json: unknown): boolean {
  const hint = mapMetaWabaIdentity(json);
  const nodeId = text(asRecord(json).id);
  return Boolean(hint.businessId && (!nodeId || hint.businessId !== nodeId));
}

async function getFields(
  graph: PortfolioGraphCaller,
  token: string,
  path: string,
  fields: string,
): Promise<MetaGraphJsonResult> {
  return graph({
    token,
    method: "GET",
    path,
    query: { fields },
  });
}

export async function fetchWabaOwner(
  graph: PortfolioGraphCaller,
  token: string,
  wabaId: string,
): Promise<{ hint: MetaWabaIdentityHint; json: unknown; ok: boolean }> {
  const id = String(wabaId || "").trim();
  if (!id) return { hint: emptyHint, json: null, ok: false };
  const res = await getFields(graph, token, id, META_WABA_OWNER_FIELDS);
  if (!res.ok) return { hint: emptyHint, json: null, ok: false };
  return { hint: mapMetaWabaIdentity(res.json), json: res.json, ok: true };
}

export async function fetchBusinessFromGraph(
  graph: PortfolioGraphCaller,
  token: string,
  businessId: string,
  seen: Set<string> = new Set(),
): Promise<{ card: MetaPortfolioPublic | null; isWaba: boolean; wabaJson: unknown }> {
  const id = String(businessId || "").trim();
  if (!id || seen.has(id)) return { card: null, isWaba: false, wabaJson: null };
  seen.add(id);

  const named = await getFields(graph, token, id, META_BUSINESS_NAME_FIELDS);
  const namedRow = asRecord(named.json);
  if (!named.ok || (!text(namedRow.id) && !text(namedRow.name))) {
    return { card: null, isWaba: false, wabaJson: null };
  }

  const ownerRes = await getFields(graph, token, id, META_WABA_OWNER_FIELDS);
  const combined = { ...asRecord(named.json), ...asRecord(ownerRes.ok ? ownerRes.json : null) };
  if (ownerRes.ok && isWabaGraphNode(combined)) {
    const hint = mapMetaWabaIdentity(combined);
    if (hint.businessId && hint.businessId !== id) {
      const owner = await fetchBusinessFromGraph(graph, token, hint.businessId, seen);
      return {
        card: owner.card
          ? { ...owner.card, wabaId: hint.wabaId || id }
          : {
              id: hint.businessId,
              name: hint.businessName,
              primaryPageId: hint.primaryPageId,
              primaryPageName: hint.primaryPageName,
              profilePictureUrl: hint.profilePictureUrl,
              wabaId: hint.wabaId || id,
            },
        isWaba: true,
        wabaJson: ownerRes.json,
      };
    }
  }

  let card = mapMetaBusinessToPortfolio(named.json, { id });
  const page = await getFields(graph, token, id, META_BUSINESS_PAGE_FIELDS);
  if (page.ok) {
    card = mergePortfolioIdentity({ fallback: card, business: page.json });
  }
  const photo = await getFields(graph, token, id, META_BUSINESS_PHOTO_FIELDS);
  if (photo.ok) {
    card = mergePortfolioIdentity({ fallback: card, business: photo.json });
  }
  if (!card.primaryPageName) {
    const owned = await graph({
      token,
      method: "GET",
      path: `${id}/owned_pages`,
      query: { fields: META_OWNED_PAGES_FIELDS },
    });
    if (owned.ok && firstOwnedPageId(owned.json)) {
      card = mergePortfolioIdentity({ fallback: card, ownedPages: owned.json });
    } else {
      const clients = await graph({
        token,
        method: "GET",
        path: `${id}/client_pages`,
        query: { fields: META_OWNED_PAGES_FIELDS },
      });
      if (clients.ok) {
        card = mergePortfolioIdentity({ fallback: card, ownedPages: clients.json });
      }
    }
  }
  if (!card.profilePictureUrl && card.primaryPageId) {
    const picture = await graph({
      token,
      method: "GET",
      path: `${card.primaryPageId}/picture`,
      query: { redirect: "0", type: "large" },
    });
    if (picture.ok) {
      card = mergePortfolioIdentity({ fallback: card, picture: picture.json });
    }
  }
  return { card: { ...card, id: card.id || id }, isWaba: false, wabaJson: null };
}

export async function fetchAssignedBusinesses(
  graph: PortfolioGraphCaller,
  token: string,
): Promise<unknown> {
  const rich = await graph({
    token,
    method: "GET",
    path: "me/businesses",
    query: { fields: "id,name,profile_picture_uri,primary_page{id,name}", limit: "50" },
  });
  if (rich.ok) return rich.json;
  const basic = await graph({
    token,
    method: "GET",
    path: "me/businesses",
    query: { fields: "id,name", limit: "50" },
  });
  return basic.ok ? basic.json : null;
}

export function directoryFromAssigned(json: unknown): MetaPortfolioPublic[] {
  return listMetaBusinessNodes(json)
    .map((row) => mapMetaBusinessToPortfolio(row, {}))
    .filter((biz) => Boolean(biz.id && biz.name));
}

export { pickMetaBusinessNode } from "./meta-whatsapp-portfolio.map";

export async function fetchKnownBusinessPortfolios(
  graph: PortfolioGraphCaller,
  token: string,
): Promise<MetaPortfolioPublic[]> {
  const out: MetaPortfolioPublic[] = [];
  for (const businessId of META_PORTFOLIO_BUSINESS_IDS) {
    const fetched = await fetchBusinessFromGraph(graph, token, businessId);
    if (fetched.card?.id && fetched.card.name && !fetched.isWaba) {
      out.push(fetched.card);
    }
  }
  return out;
}
