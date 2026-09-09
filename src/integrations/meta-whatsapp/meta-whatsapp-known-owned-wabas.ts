/**
 * WABAs owned do BM que o token Embedded Signup da conexão primária
 * costuma omitir (403 / owned seco / debug_token sem a irmã).
 *
 * André - WABA02 não aparece na Conexão se só a WABA01 estiver no fan-out.
 * Rio de Janeiro 01 (client) não entra aqui.
 */

export type KnownOwnedPendingPhone = {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  wabaId: string;
};

export type KnownOwnedBusinessWabas = {
  businessIds: string[];
  wabaIds: string[];
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

export const KNOWN_OWNED_BUSINESS_WABAS: KnownOwnedBusinessWabas[] = [
  {
    businessIds: [...ANDRE_AGUIAR_BUSINESS_IDS],
    wabaIds: [ANDRE_WABA01_ID, ANDRE_WABA02_ID],
    pendingPhones: [
      {
        phoneNumberId: ANDRE_WABA02_PENDING_PHONE_ID,
        displayPhoneNumber: "+55 11 95213-6942",
        verifiedName: "Relacionamento e Atendimento",
        wabaId: ANDRE_WABA02_ID,
      },
    ],
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
  return knownOwnedCatalogForBusiness(businessId)?.wabaIds.slice() || [];
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
