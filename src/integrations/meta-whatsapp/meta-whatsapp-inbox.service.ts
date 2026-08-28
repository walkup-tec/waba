import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { logMetaInbox } from "./meta-whatsapp-inbox-log";
import { readMetaInboxPollMs } from "./meta-config";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import { listPhoneInboxChannels, type MetaPhoneInboxChannel } from "./meta-whatsapp-phone-identity.store";
import {
  toPublicInboxConversation,
  toPublicInboxMessage,
  type MetaInboxChannelPublic,
  type MetaInboxConversationPublic,
  type MetaInboxFilter,
  type MetaInboxMessagePublic,
} from "./meta-whatsapp-inbox.types";
import type { MetaConversationRecord, MetaConversationStatus } from "./meta-whatsapp-messaging.types";
import type { MetaSendPublicResult } from "./meta-whatsapp-messaging.service";

const FILTERS = new Set<MetaInboxFilter>(["all", "unread", "open", "pending", "closed", "mine"]);
const STATUSES = new Set<MetaConversationStatus>(["open", "pending", "closed"]);

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

function parseFilter(raw: unknown): MetaInboxFilter {
  const value = String(raw || "all").trim().toLowerCase() as MetaInboxFilter;
  return FILTERS.has(value) ? value : "all";
}

function clampPage(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

function channelLabel(channel: MetaPhoneInboxChannel | undefined, fallbackPhone: string | null): string {
  return String(channel?.name || channel?.displayPhoneNumber || fallbackPhone || "WhatsApp Oficial").trim();
}

function withChannel(
  row: MetaConversationRecord,
  channelsById: Map<string, MetaPhoneInboxChannel>,
  connectionPhone: string | null,
  connectionName: string | null,
) {
  const id = String(row.phoneNumberId || "").trim();
  const snapshot = id ? channelsById.get(id) : undefined;
  return toPublicInboxConversation(row, resolveCustomerCareWindow({ lastInboundAt: row.lastInboundAt }), {
    name: channelLabel(snapshot, snapshot?.displayPhoneNumber || connectionName),
    phone: snapshot?.displayPhoneNumber || (id && id === String(connectionPhone || "") ? connectionPhone : null),
    photoUrl: snapshot?.profilePictureUrl || null,
  });
}

export class MetaWhatsappInboxService {
  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly conversations = new MetaWhatsappConversationRepository(),
    private readonly messages = new MetaWhatsappMessageRepository(),
    private readonly messaging = new MetaWhatsappMessagingService(),
  ) {}

  private async requireOwnedConversation(
    tenantId: string,
    conversationId: string,
    connectionId: string,
  ): Promise<MetaConversationRecord> {
    const row = await this.conversations.findByIdForTenant(tenantId, conversationId);
    if (!row || row.tenantId !== tenantId || row.connectionId !== connectionId) {
      throw new MetaWhatsappError("conversation_not_found");
    }
    if (row.phoneNumberId) {
      const snapshot = listPhoneInboxChannels(tenantId).find((item) => item.phoneNumberId === row.phoneNumberId);
      if (snapshot && !snapshot.inboxEnabled) {
        throw new MetaWhatsappError("conversation_not_found");
      }
    }
    return row;
  }

  async requireConnected(tenantId: string) {
    const row = await this.connections.findConnectedByTenant(tenantId);
    if (!row || row.status !== "connected" || row.tenantId !== tenantId) {
      throw new MetaWhatsappError("not_connected");
    }
    return row;
  }

  async listConversations(auth: WabaRequestAuth, query: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    const filter = parseFilter(query?.filter);
    const selectedPhone = String(query?.phoneNumberId || query?.phone_number_id || "").trim();
    const limit = Math.min(50, Math.max(1, clampPage(query?.limit, 30, 50) || 30));
    const offset = clampPage(query?.offset, 0, 10_000);
    const snapshots = listPhoneInboxChannels(tenant.tenantId);
    const channelsById = new Map(snapshots.map((row) => [row.phoneNumberId, row]));
    const disabledIds = snapshots.filter((row) => !row.inboxEnabled).map((row) => row.phoneNumberId);
    if (selectedPhone && disabledIds.includes(selectedPhone)) {
      return {
        connected: true,
        poll: readMetaInboxPollMs(),
        conversations: [],
        channels: [] as MetaInboxChannelPublic[],
        selectedPhoneNumberId: selectedPhone,
        page: { limit, offset, hasMore: false },
      };
    }
    const rows = await this.conversations.listForInbox({
      tenantId: tenant.tenantId,
      connectionId: connection.id,
      filter,
      assignedTo: auth.email,
      phoneNumberId: selectedPhone || null,
      excludePhoneNumberIds: selectedPhone ? [] : disabledIds,
      limit: limit + 1,
      offset,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const unreadRows = await this.conversations.listUnreadByPhone(tenant.tenantId, connection.id);
    const unreadByPhone = new Map<string, number>();
    let unreadAll = 0;
    for (const item of unreadRows) {
      if (item.phoneNumberId && disabledIds.includes(item.phoneNumberId)) continue;
      unreadAll += item.unreadCount;
      if (item.phoneNumberId) {
        unreadByPhone.set(item.phoneNumberId, (unreadByPhone.get(item.phoneNumberId) || 0) + item.unreadCount);
      }
    }
    const channelIds = new Set<string>();
    for (const snap of snapshots) {
      if (snap.inboxEnabled) channelIds.add(snap.phoneNumberId);
    }
    if (connection.phoneNumberId && !disabledIds.includes(connection.phoneNumberId)) {
      channelIds.add(connection.phoneNumberId);
    }
    for (const row of page) {
      if (row.phoneNumberId && !disabledIds.includes(row.phoneNumberId)) channelIds.add(row.phoneNumberId);
    }
    const channels: MetaInboxChannelPublic[] = Array.from(channelIds).map((id) => {
      const snap = channelsById.get(id);
      const isConnection = id === String(connection.phoneNumberId || "");
      return {
        phoneNumberId: id,
        name: channelLabel(snap, isConnection ? connection.verifiedName : id),
        displayPhoneNumber: snap?.displayPhoneNumber || (isConnection ? connection.displayPhoneNumber : null),
        profilePictureUrl: snap?.profilePictureUrl || null,
        unreadCount: unreadByPhone.get(id) || 0,
      };
    });
    const poll = readMetaInboxPollMs();
    logMetaInbox("LIST", { tenantId: tenant.tenantId, filter, count: page.length });
    return {
      connected: true,
      poll,
      conversations: page.map((row) =>
        withChannel(row, channelsById, connection.displayPhoneNumber, connection.verifiedName),
      ),
      channels,
      selectedPhoneNumberId: selectedPhone || null,
      unreadCount: unreadAll,
      page: { limit, offset, hasMore },
    };
  }

  async listMessages(
    auth: WabaRequestAuth,
    conversationId: string,
    query: Record<string, unknown> | undefined,
  ): Promise<{
    conversation: MetaInboxConversationPublic;
    messages: MetaInboxMessagePublic[];
  }> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
    const limit = Math.min(80, Math.max(1, clampPage(query?.limit, 80, 80) || 80));
    const messages = await this.messages.listByConversation(tenant.tenantId, row.id, limit);
    logMetaInbox("THREAD", { tenantId: tenant.tenantId, count: messages.length });
    const snapshots = listPhoneInboxChannels(tenant.tenantId);
    const channelsById = new Map(snapshots.map((item) => [item.phoneNumberId, item]));
    return {
      conversation: withChannel(row, channelsById, connection.displayPhoneNumber, connection.verifiedName),
      messages: messages.map(toPublicInboxMessage),
    };
  }

  async markRead(auth: WabaRequestAuth, conversationId: string) {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
    const updated = await this.conversations.markRead(tenant.tenantId, conversationId);
    if (!updated) throw new MetaWhatsappError("conversation_not_found");
    logMetaInbox("READ", { tenantId: tenant.tenantId });
    return toPublicInboxConversation(
      updated,
      resolveCustomerCareWindow({ lastInboundAt: updated.lastInboundAt }),
    );
  }

  async patchStatus(auth: WabaRequestAuth, conversationId: string, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
    const status = String(body?.status || "").trim().toLowerCase() as MetaConversationStatus;
    if (!STATUSES.has(status)) throw new MetaWhatsappError("invalid_payload");
    const updated = await this.conversations.patchStatus(tenant.tenantId, conversationId, status);
    if (!updated) throw new MetaWhatsappError("conversation_not_found");
    logMetaInbox("STATUS", { tenantId: tenant.tenantId, status });
    return toPublicInboxConversation(
      updated,
      resolveCustomerCareWindow({ lastInboundAt: updated.lastInboundAt }),
    );
  }

  async assign(auth: WabaRequestAuth, conversationId: string, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
    const action = String(body?.action || "").trim().toLowerCase();
    if (action !== "assume" && action !== "release") throw new MetaWhatsappError("invalid_payload");
    const assume = action === "assume";
    const updated = await this.conversations.assign(
      tenant.tenantId,
      conversationId,
      assume ? auth.email : null,
      assume,
    );
    if (!updated) throw new MetaWhatsappError("conversation_not_found");
    logMetaInbox("ASSIGN", { tenantId: tenant.tenantId, assume });
    return toPublicInboxConversation(
      updated,
      resolveCustomerCareWindow({ lastInboundAt: updated.lastInboundAt }),
    );
  }

  async sendMessage(
    auth: WabaRequestAuth,
    conversationId: string,
    body: Record<string, unknown> | undefined,
  ): Promise<MetaSendPublicResult & { message: MetaInboxMessagePublic | null }> {
    const tenant = requireTenant(auth);
    const connection = await this.requireConnected(tenant.tenantId);
    const row = await this.requireOwnedConversation(tenant.tenantId, conversationId, connection.id);
    logMetaInbox("SEND", { tenantId: tenant.tenantId, type: String(body?.type || "text") });
    const result = await this.messaging.sendFromAuth(auth, {
      ...(body && typeof body === "object" ? body : {}),
      to: row.contactWaId,
      conversationId: row.id,
      tenant_id: undefined,
      access_token: undefined,
    });
    const thread = await this.messages.listByConversation(tenant.tenantId, row.id, 1);
    const last = thread[thread.length - 1] || null;
    return {
      ...result,
      message: last ? toPublicInboxMessage(last) : null,
    };
  }
}
