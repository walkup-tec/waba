import type { MetaConversationRecord, MetaMessageRecord } from "./meta-whatsapp-messaging.types";
import type { CustomerCareWindowState } from "./meta-whatsapp-customer-care-window";

export type MetaInboxFilter = "all" | "unread" | "open" | "pending" | "closed" | "mine";

export type MetaInboxWindowLabel = "OPEN" | "CLOSED" | "UNKNOWN";

export type MetaInboxConversationPublic = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactWaId: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: MetaConversationRecord["status"];
  assignedTo: string | null;
  humanTakeover: boolean;
  phoneNumberId: string | null;
  channelName: string | null;
  channelPhone: string | null;
  channelPhotoUrl: string | null;
  agentKind: "bot" | "human";
  customerCareWindow: {
    known: boolean;
    withinWindow: boolean | null;
    state: MetaInboxWindowLabel;
  };
};

export type MetaInboxChannelPublic = {
  phoneNumberId: string;
  name: string;
  displayPhoneNumber: string | null;
  profilePictureUrl: string | null;
  unreadCount: number;
};

export type MetaInboxMessagePublic = {
  id: string;
  direction: MetaMessageRecord["direction"];
  type: string;
  status: MetaMessageRecord["status"];
  text: string | null;
  templateName: string | null;
  createdAt: string;
  errorMessage: string | null;
  source: "contact" | "bot" | "human";
};

export function windowStateFromCare(window: CustomerCareWindowState): MetaInboxWindowLabel {
  if (!window.known || window.withinWindow == null) return "UNKNOWN";
  return window.withinWindow ? "OPEN" : "CLOSED";
}

export function previewFromContent(input: {
  text?: string | null;
  type?: string;
  templateName?: string | null;
}): string {
  if (String(input.type || "") === "template") {
    const name = String(input.templateName || "template").trim();
    return `Template: ${name}`.slice(0, 80);
  }
  return String(input.text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function toPublicInboxConversation(
  row: MetaConversationRecord,
  window: CustomerCareWindowState,
  channel?: { name?: string | null; phone?: string | null; photoUrl?: string | null },
): MetaInboxConversationPublic {
  return {
    id: row.id,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactWaId: row.contactWaId,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount,
    status: row.status,
    assignedTo: row.assignedTo,
    humanTakeover: row.humanTakeover,
    phoneNumberId: row.phoneNumberId,
    channelName: channel?.name || null,
    channelPhone: channel?.phone || null,
    channelPhotoUrl: channel?.photoUrl || null,
    agentKind: row.humanTakeover ? "human" : "bot",
    customerCareWindow: {
      known: window.known,
      withinWindow: window.withinWindow,
      state: windowStateFromCare(window),
    },
  };
}

export function toPublicInboxMessage(row: MetaMessageRecord): MetaInboxMessagePublic {
  const source =
    row.direction === "inbound" ? "contact" : row.provider === "automation" ? "bot" : "human";
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    status: row.status,
    text: row.textContent,
    templateName: row.templateName,
    createdAt: row.createdAt,
    errorMessage: row.status === "failed" ? row.errorMessage || "Não foi possível enviar." : null,
    source,
  };
}
