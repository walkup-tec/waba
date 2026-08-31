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
