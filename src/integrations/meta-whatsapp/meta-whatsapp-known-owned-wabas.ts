/**
 * WABAs owned do BM que o token Embedded Signup da conexão primária
 * costuma omitir (403 / owned seco / debug_token sem a irmã).
 *
 * André - WABA02 não aparece na Conexão se só a WABA01 estiver no fan-out.
 * Rio de Janeiro 01 (client) não entra aqui.
 * Chip só entra no card se a Graph ainda devolver o número; catálogo local
 * não inventa pendente já excluído do Business Manager.
 */

export type KnownOwnedPendingPhone = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  wabaId: string;
};

export type KnownOwnedWabaRow = {
  id: string;
  name: string;
};

export type KnownOwnedBusinessWabas = {
  businessIds: string[];
  wabas: KnownOwnedWabaRow[];
  clientWabaIds: string[];
  pendingPhones: KnownOwnedPendingPhone[];
};

export const ANDRE_AGUIAR_BUSINESS_IDS = [
  "1759044748332124",
  "759044748332124",
  "60843286",
] as const;

export const ANDRE_WABA01_ID = "2458602464640240";
export const ANDRE_WABA02_ID = "1744257946809067";
export const ANDRE_WABA02_PENDING_PHONE_ID = "1311179632078208";
export const RIO_DE_JANEIRO_01_WABA_ID = "1581808413746453";

export const DRAX_SISTEMAS_BUSINESS_IDS = ["1041827648719609"] as const;
export const DRAX_SISTEMAS_WABA_ID = "1636793994538054";

export const WALKUP_BUSINESS_IDS = ["4141369862822598"] as const;
export const WALKUP_WABA01_ID = "1014470201624992";

/** Card Grupo Walkup App — WABA gravada no banco já veio misturada (Drax). */
export const WALKUP_APP_BUSINESS_IDS = ["1247508354180311"] as const;

/** Reabrir só estes BMs após o disconnect agressivo por WABA antiga. */
export function businessIdsToReopenAfterFalseLeftManager(): string[] {
  return [...DRAX_SISTEMAS_BUSINESS_IDS, ...WALKUP_BUSINESS_IDS, ...WALKUP_APP_BUSINESS_IDS];
}

export const KNOWN_OWNED_BUSINESS_WABAS: KnownOwnedBusinessWabas[] = [
  {
    businessIds: [...ANDRE_AGUIAR_BUSINESS_IDS],
    wabas: [
      { id: ANDRE_WABA01_ID, name: "André - WABA01" },
      { id: ANDRE_WABA02_ID, name: "André - WABA02" },
    ],
    clientWabaIds: [RIO_DE_JANEIRO_01_WABA_ID],
    pendingPhones: [],
  },
  {
    businessIds: [...DRAX_SISTEMAS_BUSINESS_IDS],
    wabas: [{ id: DRAX_SISTEMAS_WABA_ID, name: "Drax Sistemas" }],
    clientWabaIds: [],
    pendingPhones: [],
  },
  {
    businessIds: [...WALKUP_BUSINESS_IDS],
    wabas: [{ id: WALKUP_WABA01_ID, name: "WABA 01" }],
    clientWabaIds: [],
    pendingPhones: [],
  },
];

export function normalizeMetaBusinessKey(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function metaBusinessIdsMatch(left: string, right: string): boolean {
  const a = normalizeMetaBusinessKey(left);
  const b = normalizeMetaBusinessKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length === b.length + 1 && a.startsWith("1") && a.slice(1) === b) return true;
  if (b.length === a.length + 1 && b.startsWith("1") && b.slice(1) === a) return true;
  return false;
}

/** CNPJ do card (60.843.286) e o id Graph do BM do André são o mesmo portfólio. */
export function knownOwnedBusinessesMatch(left: string, right: string): boolean {
  if (metaBusinessIdsMatch(left, right)) return true;
  const a = knownOwnedCatalogForBusiness(left);
  const b = knownOwnedCatalogForBusiness(right);
  return Boolean(a && b && a === b);
}

export function knownOwnedCatalogForBusiness(businessId: string): KnownOwnedBusinessWabas | null {
  const wanted = String(businessId || "").trim();
  if (!wanted) return null;
  return (
    KNOWN_OWNED_BUSINESS_WABAS.find((row) =>
      row.businessIds.some((id) => metaBusinessIdsMatch(id, wanted)),
    ) || null
  );
}

export function knownOwnedWabaIdsForBusiness(businessId: string): string[] {
  return (knownOwnedCatalogForBusiness(businessId)?.wabas || []).map((row) => row.id);
}

export function knownOwnedWabaRowsForBusiness(businessId: string): KnownOwnedWabaRow[] {
  return knownOwnedCatalogForBusiness(businessId)?.wabas.slice() || [];
}

export function knownClientWabaIdsForBusiness(businessId: string): string[] {
  return knownOwnedCatalogForBusiness(businessId)?.clientWabaIds.slice() || [];
}

export function isKnownClientWabaForBusiness(businessId: string, wabaId: string): boolean {
  const id = String(wabaId || "").trim();
  if (!id) return false;
  return knownClientWabaIdsForBusiness(businessId).includes(id);
}

/** WABA client de qualquer BM catalogado (ex.: Rio) — não entra no sync de outro portfólio. */
export function isKnownClientWabaId(wabaId: string): boolean {
  const id = String(wabaId || "").trim();
  if (!id) return false;
  return KNOWN_OWNED_BUSINESS_WABAS.some((row) => row.clientWabaIds.includes(id));
}

export function knownWabaIdForPendingPhone(phoneNumberId: string): string {
  const id = String(phoneNumberId || "").trim();
  if (!id) return "";
  for (const catalog of KNOWN_OWNED_BUSINESS_WABAS) {
    const phone = catalog.pendingPhones.find((row) => row.phoneNumberId === id);
    if (phone) return phone.wabaId;
  }
  return "";
}

export function knownWabaNameForId(wabaId: string): string {
  const id = String(wabaId || "").trim();
  if (!id) return "";
  for (const catalog of KNOWN_OWNED_BUSINESS_WABAS) {
    const row = catalog.wabas.find((item) => item.id === id);
    if (row) return row.name;
  }
  return "";
}

export function knownPendingPhonesForBusiness(businessId: string): KnownOwnedPendingPhone[] {
  return knownOwnedCatalogForBusiness(businessId)?.pendingPhones.slice() || [];
}

export function knownPendingPhoneGraphRow(phone: KnownOwnedPendingPhone): Record<string, unknown> {
  return {
    id: phone.phoneNumberId,
    display_phone_number: phone.displayPhoneNumber,
    verified_name: phone.verifiedName,
    status: "PENDING",
    code_verification_status: "VERIFIED",
    _portfolio_waba_id: phone.wabaId,
    whatsapp_business_account: { id: phone.wabaId },
  };
}
