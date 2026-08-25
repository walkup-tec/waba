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
  customerCareWindow: {
    known: boolean;
    withinWindow: boolean | null;
    state: MetaInboxWindowLabel;
  };
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
    customerCareWindow: {
      known: window.known,
      withinWindow: window.withinWindow,
      state: windowStateFromCare(window),
    },
  };
}

export function toPublicInboxMessage(row: MetaMessageRecord): MetaInboxMessagePublic {
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    status: row.status,
    text: row.textContent,
    templateName: row.templateName,
    createdAt: row.createdAt,
    errorMessage: row.status === "failed" ? row.errorMessage || "Não foi possível enviar." : null,
  };
}
