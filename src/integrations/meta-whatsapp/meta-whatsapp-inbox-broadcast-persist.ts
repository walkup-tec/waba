import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import { MetaWhatsappTemplateRepository } from "./meta-whatsapp-template.repository";
import { findBroadcastLeadForInbox } from "./meta-whatsapp-broadcast.store";
import { inspectMetaBroadcastTemplate } from "./meta-whatsapp-broadcast-template";
import { previewFromContent } from "./meta-whatsapp-inbox.types";
import {
  extractTemplateBodyText,
  isGenericInboxPreview,
  renderTemplateBodyText,
} from "./meta-whatsapp-inbox-template-preview";
import type { MetaMessageStatus } from "./meta-whatsapp-messaging.types";

export type InboxBroadcastMatch = {
  campaign: {
    templateId?: string | null;
    templateName: string;
    language: string;
    connectionId: string;
  };
  lead: {
    waId: string;
    nome?: string;
    numero?: string;
    texto?: string;
    previewText?: string;
    wamid?: string;
    phoneNumberId?: string;
    connectionId?: string;
  };
};

export type InboxBroadcastMatcher = (input: {
  tenantId: string;
  wamid?: string | null;
  recipientId?: string | null;
  phoneNumberId?: string | null;
}) => InboxBroadcastMatch | null;

export type InboxTemplateBodyLookup = (input: {
  tenantId: string;
  connectionId?: string | null;
  templateId?: string | null;
  templateName: string;
  language: string;
}) => Promise<string | null>;

const bodyCache = new Map<string, string>();

export function defaultInboxBroadcastMatcher(input: {
  tenantId: string;
  wamid?: string | null;
  recipientId?: string | null;
  phoneNumberId?: string | null;
}): InboxBroadcastMatch | null {
  return findBroadcastLeadForInbox(input);
}

export async function defaultInboxTemplateBodyLookup(input: {
  tenantId: string;
  connectionId?: string | null;
  templateId?: string | null;
  templateName: string;
  language: string;
}): Promise<string | null> {
  const key = [
    input.tenantId,
    input.templateId || "",
    input.connectionId || "",
    input.templateName,
    input.language,
  ].join("|");
  const cached = bodyCache.get(key);
  if (cached != null) return cached || null;
  const repo = new MetaWhatsappTemplateRepository();
  try {
    if (input.templateId) {
      const byId = await repo.findByIdForTenant(input.tenantId, input.templateId);
      const text = extractTemplateBodyText(byId?.components);
      if (text) {
        bodyCache.set(key, text);
        return text;
      }
    }
    if (input.connectionId) {
      const byConn = await repo.findForSend(
        input.tenantId,
        input.connectionId,
        input.templateName,
        input.language,
      );
      const text = extractTemplateBodyText(byConn?.components);
      if (text) {
        bodyCache.set(key, text);
        return text;
      }
    }
    const byName = await repo.findByNameLanguage(input.tenantId, input.templateName, input.language);
    const text = extractTemplateBodyText(byName?.components);
    bodyCache.set(key, text);
    return text || null;
  } catch {
    return null;
  }
}

export async function resolveBroadcastInboxText(input: {
  tenantId: string;
  match: InboxBroadcastMatch;
  lookup?: InboxTemplateBodyLookup;
  sendComponents?: unknown;
}): Promise<string> {
  const stored = String(input.match.lead.previewText || "").trim();
  if (stored) return stored;
  const lookup = input.lookup || defaultInboxTemplateBodyLookup;
  const bodyText = await lookup({
    tenantId: input.tenantId,
    connectionId: input.match.lead.connectionId || input.match.campaign.connectionId,
    templateId: input.match.campaign.templateId,
    templateName: input.match.campaign.templateName,
    language: input.match.campaign.language,
  });
  return renderTemplateBodyText({
    bodyText,
    inspect: bodyText ? inspectMetaBroadcastTemplate([{ type: "BODY", text: bodyText }]) : null,
    lead: input.match.lead,
    sendComponents: input.sendComponents,
  });
}

export async function persistBroadcastOutboundInInbox(input: {
  tenantId: string;
  connectionId: string;
  phoneNumberId: string;
  contactWaId: string;
  contactName?: string | null;
  wamid?: string | null;
  status?: MetaMessageStatus;
  atIso: string;
  text: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  conversations: Pick<MetaWhatsappConversationRepository, "upsertForContact" | "patchLastMessagePreview">;
  messages: Pick<
    MetaWhatsappMessageRepository,
    "findByTenantWamid" | "insert" | "listByConversation"
  >;
  conversationId?: string | null;
}): Promise<{ conversationId: string; inserted: boolean }> {
  const text = String(input.text || "").replace(/\s+/g, " ").trim();
  const preview = previewFromContent({
    type: text ? "text" : "template",
    text,
    templateName: input.templateName,
  });
  let conversationId = String(input.conversationId || "").trim();
  if (conversationId && typeof input.conversations.patchLastMessagePreview === "function") {
    if (text && preview) {
      await input.conversations.patchLastMessagePreview(input.tenantId, conversationId, preview);
    }
  } else {
    const upserted = await input.conversations.upsertForContact({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      phoneNumberId: input.phoneNumberId,
      contactWaId: input.contactWaId,
      contactPhone: input.contactWaId,
      contactName: input.contactName,
      outbound: true,
      lastMessagePreview: preview,
      atIso: input.atIso,
    });
    conversationId = upserted.record.id;
  }
  const wamid = String(input.wamid || "").trim();
  if (wamid) {
    const existing = await input.messages.findByTenantWamid(input.tenantId, wamid);
    if (existing) return { conversationId, inserted: false };
  }
  const listed = await input.messages.listByConversation(input.tenantId, conversationId, 1);
  if (listed.length) return { conversationId, inserted: false };
  const inserted = await input.messages.insert({
    tenantId: input.tenantId,
    conversationId,
    connectionId: input.connectionId,
    wamid: wamid || null,
    direction: "outbound",
    type: "template",
    status: input.status || "accepted",
    fromWaId: input.phoneNumberId,
    toWaId: input.contactWaId,
    textContent: text || null,
    templateName: input.templateName || null,
    templateLanguage: input.templateLanguage || null,
    provider: "meta-cloud",
  });
  return { conversationId, inserted: !inserted.duplicate };
}

export async function enrichInboxFromBroadcast(input: {
  tenantId: string;
  conversation: {
    id: string;
    connectionId: string;
    phoneNumberId: string | null;
    contactWaId: string;
    contactName?: string | null;
    lastMessagePreview?: string | null;
  };
  conversations: Pick<MetaWhatsappConversationRepository, "upsertForContact" | "patchLastMessagePreview">;
  messages: Pick<
    MetaWhatsappMessageRepository,
    "findByTenantWamid" | "insert" | "listByConversation"
  >;
  matchBroadcast?: InboxBroadcastMatcher;
  lookupBody?: InboxTemplateBodyLookup;
  force?: boolean;
}): Promise<{ preview: string | null; inserted: boolean }> {
  const needsPreview = input.force || isGenericInboxPreview(input.conversation.lastMessagePreview);
  const listed = await input.messages.listByConversation(input.tenantId, input.conversation.id, 1);
  if (!needsPreview && listed.length) {
    return { preview: input.conversation.lastMessagePreview || null, inserted: false };
  }
  const matcher = input.matchBroadcast || defaultInboxBroadcastMatcher;
  const match = matcher({
    tenantId: input.tenantId,
    recipientId: input.conversation.contactWaId,
    phoneNumberId: input.conversation.phoneNumberId,
  });
  if (!match) {
    return { preview: input.conversation.lastMessagePreview || null, inserted: false };
  }
  const text = await resolveBroadcastInboxText({
    tenantId: input.tenantId,
    match,
    lookup: input.lookupBody,
  });
  if (!text && !match.campaign.templateName) {
    return { preview: input.conversation.lastMessagePreview || null, inserted: false };
  }
  const persisted = await persistBroadcastOutboundInInbox({
    tenantId: input.tenantId,
    connectionId: match.lead.connectionId || match.campaign.connectionId || input.conversation.connectionId,
    phoneNumberId: String(match.lead.phoneNumberId || input.conversation.phoneNumberId || "").trim(),
    contactWaId: input.conversation.contactWaId,
    contactName: input.conversation.contactName || match.lead.nome || null,
    wamid: match.lead.wamid || null,
    status: "accepted",
    atIso: new Date().toISOString(),
    text: text || "",
    templateName: match.campaign.templateName,
    templateLanguage: match.campaign.language,
    conversations: input.conversations,
    messages: input.messages,
    conversationId: input.conversation.id,
  });
  const preview = previewFromContent({
    type: text ? "text" : "template",
    text,
    templateName: match.campaign.templateName,
  });
  return { preview, inserted: persisted.inserted };
}
