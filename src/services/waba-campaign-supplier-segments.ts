import type { SplitSupplier } from "../billing/waba-financeiro-split.repository";
import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

export const toSupplierSegment = (value: unknown): WabaSystemUserOperacionalSegment =>
  String(value || "").trim().toLowerCase() === "bets" ? "bets" : "outros";

export const toSupplierApiKind = (value: unknown): WabaDispatchesApiKind =>
  String(value || "").trim().toLowerCase() === "alternativa" ? "alternativa" : "oficial";

export const toCampaignSupplierSegment = (
  subscriberSegment: WabaSubscriberSegment,
): WabaSystemUserOperacionalSegment => (subscriberSegment === "bets" ? "bets" : "outros");

const isActiveSupplierRow = (row: SplitSupplier): boolean => row.active !== false;

export const listFinanceiroSegmentsForEmail = (
  suppliers: SplitSupplier[] | null | undefined,
  emailRaw: string,
): WabaSystemUserOperacionalSegment[] => {
  const email = normalizeEmail(emailRaw);
  if (!email) return [];
  const found = new Set<WabaSystemUserOperacionalSegment>();
  for (const row of suppliers ?? []) {
    if (!isActiveSupplierRow(row)) continue;
    if (normalizeEmail(row.systemUserEmail) !== email) continue;
    found.add(toSupplierSegment(row.segment));
  }
  const ordered: WabaSystemUserOperacionalSegment[] = [];
  if (found.has("bets")) ordered.push("bets");
  if (found.has("outros")) ordered.push("outros");
  return ordered;
};

export const mergeOperacionalSegmentLists = (
  ...lists: Array<WabaSystemUserOperacionalSegment[] | null | undefined>
): WabaSystemUserOperacionalSegment[] => {
  const found = new Set<WabaSystemUserOperacionalSegment>();
  for (const list of lists) {
    for (const item of list ?? []) {
      found.add(item === "bets" ? "bets" : "outros");
    }
  }
  const ordered: WabaSystemUserOperacionalSegment[] = [];
  if (found.has("bets")) ordered.push("bets");
  if (found.has("outros")) ordered.push("outros");
  return ordered;
};

export const financeiroRowServesCampaign = (
  row: SplitSupplier,
  emailRaw: string,
  apiKind: WabaDispatchesApiKind,
  subscriberSegment: WabaSubscriberSegment,
): boolean => {
  if (!isActiveSupplierRow(row)) return false;
  if (normalizeEmail(row.systemUserEmail) !== normalizeEmail(emailRaw)) return false;
  if (toSupplierApiKind(row.apiKind) !== apiKind) return false;
  return toSupplierSegment(row.segment) === toCampaignSupplierSegment(subscriberSegment);
};

export const financeiroServesCampaign = (
  suppliers: SplitSupplier[] | null | undefined,
  emailRaw: string,
  apiKind: WabaDispatchesApiKind,
  subscriberSegment: WabaSubscriberSegment,
): boolean =>
  (suppliers ?? []).some((row) => financeiroRowServesCampaign(row, emailRaw, apiKind, subscriberSegment));
