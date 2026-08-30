import type { MetaGraphJsonResult } from "./meta-whatsapp-graph.client";
import {
  mapMetaBusinessToPortfolio,
  mapMetaWabaIdentity,
  mergePortfolioIdentity,
  listMetaBusinessNodes,
  firstOwnedPageId,
  graphPhotoDownloadUrl,
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
export const META_WABA_PAGE_FIELDS =
  "owner_business_info{id,name,primary_page{id,name}},on_behalf_of_business_info{id,name,primary_page{id,name}}";
export const META_BUSINESS_NAME_FIELDS = "id,name";
export const META_BUSINESS_PAGE_FIELDS = "primary_page{id,name}";
export const META_BUSINESS_PAGE_ID_FIELDS = "primary_page{id}";
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
  let json = res.json;
  let hint = mapMetaWabaIdentity(json);
  if (!hint.primaryPageName) {
    const extra = await getFields(graph, token, id, META_WABA_PAGE_FIELDS);
    if (extra.ok) {
      const mergedJson = { ...asRecord(res.json), ...asRecord(extra.json) };
      const extraHint = mapMetaWabaIdentity(mergedJson);
      if (extraHint.primaryPageName || extraHint.primaryPageId) {
        json = mergedJson;
        hint = extraHint;
      }
    }
  }
  return { hint, json, ok: true };
}

async function mergePrimaryPageFromGraph(
  graph: PortfolioGraphCaller,
  token: string,
  businessId: string,
  card: MetaPortfolioPublic,
  pageRes: MetaGraphJsonResult,
): Promise<MetaPortfolioPublic> {
  if (pageRes.ok) {
    return mergePortfolioIdentity({ fallback: card, business: pageRes.json });
  }
  for (const fields of [META_BUSINESS_PAGE_ID_FIELDS, "primary_page"]) {
    const retry = await getFields(graph, token, businessId, fields);
    if (retry.ok) {
      return mergePortfolioIdentity({ fallback: card, business: retry.json });
    }
  }
  return card;
}

async function mergePageEdges(
  graph: PortfolioGraphCaller,
  token: string,
  businessId: string,
  card: MetaPortfolioPublic,
  photoDownloadUrl: string | null,
): Promise<{ card: MetaPortfolioPublic; photoDownloadUrl: string | null }> {
  if (card.primaryPageName) return { card, photoDownloadUrl };
  let next = card;
  let photo = photoDownloadUrl;
  for (const edge of ["owned_pages", "client_pages", "assigned_pages"]) {
    const pages = await graph({
      token,
      method: "GET",
      path: `${businessId}/${edge}`,
      query: { fields: META_OWNED_PAGES_FIELDS },
    });
    if (!pages.ok || !firstOwnedPageId(pages.json)) continue;
    next = mergePortfolioIdentity({ fallback: next, ownedPages: pages.json });
    photo = photo || graphPhotoDownloadUrl(pages.json);
    if (next.primaryPageName) break;
  }
  return { card: next, photoDownloadUrl: photo };
}

async function fillPageNameById(
  graph: PortfolioGraphCaller,
  token: string,
  businessId: string,
  card: MetaPortfolioPublic,
): Promise<MetaPortfolioPublic> {
  const pageId = String(card.primaryPageId || "").trim();
  if (!pageId || card.primaryPageName || pageId === businessId) return card;
  const named = await getFields(graph, token, pageId, "id,name");
  if (!named.ok) return card;
  const row = asRecord(named.json);
  const pageName = text(row.name);
  const namedId = text(row.id) || pageId;
  if (!pageName || namedId === businessId) return card;
  return mergePortfolioIdentity({
    fallback: card,
    business: { primary_page: { id: namedId, name: pageName } },
  });
}

export type FetchBusinessGraphResult = {
  card: MetaPortfolioPublic | null;
  isWaba: boolean;
  wabaJson: unknown;
  photoDownloadUrl: string | null;
};

export async function fetchBusinessFromGraph(
  graph: PortfolioGraphCaller,
  token: string,
  businessId: string,
  seen: Set<string> = new Set(),
): Promise<FetchBusinessGraphResult> {
  const id = String(businessId || "").trim();
  if (!id || seen.has(id)) return { card: null, isWaba: false, wabaJson: null, photoDownloadUrl: null };
  seen.add(id);

  const named = await getFields(graph, token, id, META_BUSINESS_NAME_FIELDS);
  const namedRow = asRecord(named.json);
  if (!named.ok || (!text(namedRow.id) && !text(namedRow.name))) {
    return { card: null, isWaba: false, wabaJson: null, photoDownloadUrl: null };
  }

  const [ownerRes, page, photo] = await Promise.all([
    getFields(graph, token, id, META_WABA_OWNER_FIELDS),
    getFields(graph, token, id, META_BUSINESS_PAGE_FIELDS),
    getFields(graph, token, id, META_BUSINESS_PHOTO_FIELDS),
  ]);
  const combined = { ...asRecord(named.json), ...asRecord(ownerRes.ok ? ownerRes.json : null) };
  if (ownerRes.ok && isWabaGraphNode(combined)) {
    let hint = mapMetaWabaIdentity(combined);
    if (!hint.primaryPageName) {
      const extra = await getFields(graph, token, id, META_WABA_PAGE_FIELDS);
      if (extra.ok) {
        const extraHint = mapMetaWabaIdentity({ ...combined, ...asRecord(extra.json) });
        if (extraHint.primaryPageName || extraHint.primaryPageId) hint = extraHint;
      }
    }
    if (hint.businessId && hint.businessId !== id) {
      const owner = await fetchBusinessFromGraph(graph, token, hint.businessId, seen);
      return {
        card: owner.card
          ? {
              ...owner.card,
              wabaId: hint.wabaId || id,
              primaryPageId: owner.card.primaryPageId || hint.primaryPageId,
              primaryPageName: owner.card.primaryPageName || hint.primaryPageName,
            }
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
        photoDownloadUrl: owner.photoDownloadUrl || graphPhotoDownloadUrl(ownerRes.json),
      };
    }
  }

  let card = mapMetaBusinessToPortfolio(named.json, { id });
  card = await mergePrimaryPageFromGraph(graph, token, id, card, page);
  if (photo.ok) {
    card = mergePortfolioIdentity({ fallback: card, business: photo.json });
  }
  let photoDownloadUrl =
    graphPhotoDownloadUrl(photo.json) ||
    graphPhotoDownloadUrl(page.json) ||
    graphPhotoDownloadUrl(ownerRes.json) ||
    card.profilePictureUrl;
  const fromEdges = await mergePageEdges(graph, token, id, card, photoDownloadUrl);
  card = fromEdges.card;
  photoDownloadUrl = fromEdges.photoDownloadUrl;
  card = await fillPageNameById(graph, token, id, card);
  if (!card.profilePictureUrl && !photoDownloadUrl) {
    const picture = await graph({
      token,
      method: "GET",
      path: `${id}/picture`,
      query: { redirect: "0", type: "large" },
    });
    if (picture.ok) {
      card = mergePortfolioIdentity({ fallback: card, picture: picture.json });
      photoDownloadUrl = graphPhotoDownloadUrl(picture.json) || photoDownloadUrl;
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
      photoDownloadUrl = photoDownloadUrl || graphPhotoDownloadUrl(picture.json);
    }
  }
  return {
    card: { ...card, id: card.id || id },
    isWaba: false,
    wabaJson: null,
    photoDownloadUrl: photoDownloadUrl || card.profilePictureUrl,
  };
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
