export type MetaMessageDirection = "inbound" | "outbound";

export type MetaMessageStatus =
  | "queued"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type MetaConversationStatus = "open" | "pending" | "closed";

export type MetaConversationRecord = {
  id: string;
  tenantId: string;
  connectionId: string;
  phoneNumberId: string | null;
  contactWaId: string;
  contactPhone: string | null;
  contactName: string | null;
  status: MetaConversationStatus;
  assignedTo: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadCount: number;
  humanTakeover: boolean;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MetaMessageRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  connectionId: string;
  wamid: string | null;
  direction: MetaMessageDirection;
  type: string;
  status: MetaMessageStatus;
  fromWaId: string | null;
  toWaId: string | null;
  textContent: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  provider: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_RANK: Record<MetaMessageStatus, number> = {
  queued: 0,
  accepted: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 50,
};

export function canAdvanceMetaMessageStatus(
  current: MetaMessageStatus,
  next: MetaMessageStatus,
): boolean {
  if (current === next) return false;
  if (current === "failed") return false;
  if (current === "read" && next !== "failed") return false;
  if (next === "failed") {
    return current === "queued" || current === "accepted" || current === "sent";
  }
  return STATUS_RANK[next] > STATUS_RANK[current];
}

export function mapWebhookStatus(raw: string | null | undefined): MetaMessageStatus | null {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "sent") return "sent";
  if (value === "delivered") return "delivered";
  if (value === "read") return "read";
  if (value === "failed") return "failed";
  return null;
}
