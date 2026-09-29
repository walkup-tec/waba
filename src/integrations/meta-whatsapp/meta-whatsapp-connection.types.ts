export type MetaWhatsappConnectionStatus =
  | "pending_token"
  | "pending_confirmation"
  | "connected"
  | "disconnected"
  | "error"
  | "invalid_token";

export type MetaWhatsappConnectionRecord = {
  id: string;
  tenantId: string;
  ownerEmail: string;
  metaBusinessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  accessTokenEncrypted: string;
  tokenType: string;
  tokenExpiresAt: string | null;
  configId: string | null;
  status: MetaWhatsappConnectionStatus;
  qualityRating: string | null;
  messagingLimit: string | null;
  lastTokenValidationAt: string | null;
  lastWebhookAt: string | null;
  lastError: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
};

export type MetaWhatsappUiStatus =
  | "nao_conectado"
  | "aguardando_confirmacao"
  | "conectado"
  | "erro";

export type MetaWhatsappPublicConnection = {
  connected: boolean;
  pending: boolean;
  wabaId: string | null;
  phoneNumberId: string | null;
  businessId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  status: MetaWhatsappConnectionStatus;
  uiStatus: MetaWhatsappUiStatus;
};

export type MetaWhatsappTenant = {
  tenantId: string;
  ownerEmail: string;
};

const OFFICIAL_GRAPH_STATUSES: ReadonlySet<MetaWhatsappConnectionStatus> = new Set([
  "connected",
  "pending_confirmation",
  "pending_token",
]);

/** Card do Lab com WABA: connected, pending_confirmation ou pending_token da BM convidada. */
export function isOfficialWabaConnection<
  T extends Pick<MetaWhatsappConnectionRecord, "status" | "disconnectedAt" | "wabaId" | "tenantId">,
>(row: T | null | undefined, tenantId?: string): row is T {
  if (!row || row.disconnectedAt) return false;
  if (tenantId && row.tenantId !== tenantId) return false;
  if (!String(row.wabaId || "").trim()) return false;
  return OFFICIAL_GRAPH_STATUSES.has(row.status);
}

/** Envio Cloud: mesmo card, com token e um número (no registro ou no disparo). */
export function isOfficialSendConnection<
  T extends Pick<
    MetaWhatsappConnectionRecord,
    "status" | "disconnectedAt" | "wabaId" | "tenantId" | "phoneNumberId" | "accessTokenEncrypted"
  >,
>(row: T | null | undefined, tenantId: string, phoneNumberId?: string): row is T {
  if (!isOfficialWabaConnection(row, tenantId)) return false;
  if (!String(row.accessTokenEncrypted || "").trim()) return false;
  return Boolean(String(row.phoneNumberId || phoneNumberId || "").trim());
}
