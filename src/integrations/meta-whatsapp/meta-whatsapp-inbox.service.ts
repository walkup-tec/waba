import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { MetaWhatsappConnectionRepository } from "./meta-whatsapp-connection.repository";
import { MetaWhatsappConversationRepository } from "./meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "./meta-whatsapp-message.repository";
import { MetaWhatsappMessagingService } from "./meta-whatsapp-messaging.service";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { MetaWhatsappWebhookSubscriptionService } from "./meta-whatsapp-webhook-subscription.service";
import { logMetaInbox } from "./meta-whatsapp-inbox-log";
import { readMetaInboxPollMs } from "./meta-config";
import { resolveCustomerCareWindow } from "./meta-whatsapp-customer-care-window";
import { listPhoneInboxChannels, inboxQueryPhoneIds, isInboxPhoneAllowed, type MetaPhoneInboxChannel } from "./meta-whatsapp-phone-identity.store";
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
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import { pickConnectionsForWebhookSubscribe } from "./meta-whatsapp-connection.service";

const FILTERS = new Set<MetaInboxFilter>(["all", "unread", "open", "pending", "closed", "mine"]);
const STATUSES = new Set<MetaConversationStatus>(["open", "pending", "closed"]);
const inboxWebhookEnsureAt = new Map<string, number>();
const INBOX_WEBHOOK_ENSURE_MS = 60_000;

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

function channelLabel(channel: MetaPhoneInboxChannel | undefined, verifiedName?: string | null): string {
  const meta = String(verifiedName || "").trim();
  if (meta) return meta;
  return String(channel?.name || channel?.displayPhoneNumber || "WhatsApp Oficial").trim();
}

function verifiedNamesByPhone(
  connections: Array<{ phoneNumberId: string | null; verifiedName: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of connections) {
    const id = String(row.phoneNumberId || "").trim();
    const name = String(row.verifiedName || "").trim();
    if (id && name) map.set(id, name);
  }
  return map;
}

function canServeInbox(row: { tenantId: string; status: string; wabaId: string | null; phoneNumberId: string | null; disconnectedAt: string | null } | null, tenantId: string): boolean {
  return Boolean(
    row &&
      row.tenantId === tenantId &&
      !row.disconnectedAt &&
      row.wabaId &&
      row.phoneNumberId &&
      (row.status === "connected" || row.status === "pending_confirmation"),
  );
}

function withChannel(
  row: MetaConversationRecord,
  channelsById: Map<string, MetaPhoneInboxChannel>,
  connectionPhone: string | null,
  connectionName: string | null,
  verifiedByPhone: Map<string, string>,
) {
  const id = String(row.phoneNumberId || "").trim();
  const snapshot = id ? channelsById.get(id) : undefined;
  const verified =
    (id && verifiedByPhone.get(id)) ||
    (id && id === String(connectionPhone || "") ? connectionName : null);
  return toPublicInboxConversation(row, resolveCustomerCareWindow({ lastInboundAt: row.lastInboundAt }), {
    name: channelLabel(snapshot, verified),
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

  private async inboxConnections(tenantId: string) {
    const open = await this.connections.listInboxConnections(tenantId);
    const usable = open.filter((row) => canServeInbox(row, tenantId));
    if (!usable.length) {
      const fallback = await this.requireConnected(tenantId);
      return [fallback];
    }
    return usable;
  }

  private async requireOwnedConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<MetaConversationRecord> {
    const row = await this.conversations.findByIdForTenant(tenantId, conversationId);
    if (!row || row.tenantId !== tenantId) {
      throw new MetaWhatsappError("conversation_not_found");
    }
    const open = await this.inboxConnections(tenantId);
    const connPhones = open.map((item) => item.phoneNumberId).filter((id): id is string => Boolean(id));
    if (!isInboxPhoneAllowed(tenantId, row.phoneNumberId, connPhones)) {
      throw new MetaWhatsappError("conversation_not_found");
    }
    return row;
  }

  /** Garante subscribed_apps em todas as WABAs abertas (throttle 60s) para inbound chegar no Atendimento. */
  private async ensureWebhooksForOpenConnections(
    tenantId: string,
    open: MetaWhatsappConnectionRecord[],
  ): Promise<void> {
    const now = Date.now();
    const last = inboxWebhookEnsureAt.get(tenantId) || 0;
    if (now - last < INBOX_WEBHOOK_ENSURE_MS) return;
    inboxWebhookEnsureAt.set(tenantId, now);
    const targets = pickConnectionsForWebhookSubscribe(open);
    if (!targets.length) return;
    const sub = new MetaWhatsappWebhookSubscriptionService();
    for (const connection of targets) {
      try {
        await sub.ensureSubscribed(connection);
      } catch {
        logMetaInbox("ERROR", { reason: "webhook_ensure_fail", tenantId, connectionId: connection.id });
      }
    }
  }

  async requireConnected(tenantId: string) {
    const connected = await this.connections.findConnectedByTenant(tenantId);
    if (canServeInbox(connected, tenantId) && connected) return connected;
    const open = await this.connections.findOpenByTenant(tenantId);
    if (canServeInbox(open, tenantId) && open) return open;
    throw new MetaWhatsappError("not_connected");
  }

  async listConversations(auth: WabaRequestAuth, query: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    const open = await this.inboxConnections(tenant.tenantId);
    void this.ensureWebhooksForOpenConnections(tenant.tenantId, open);
    const connection = open[0];
    const filter = parseFilter(query?.filter);
    const selectedPhone = String(query?.phoneNumberId || query?.phone_number_id || "").trim();
    const limit = Math.min(50, Math.max(1, clampPage(query?.limit, 30, 50) || 30));
    const offset = clampPage(query?.offset, 0, 10_000);
    const verifiedByPhone = verifiedNamesByPhone(open);
    const snapshots = listPhoneInboxChannels(tenant.tenantId, verifiedByPhone);
    const channelsById = new Map(snapshots.map((row) => [row.phoneNumberId, row]));
    const enabledIds = snapshots.filter((row) => row.inboxEnabled).map((row) => row.phoneNumberId);
    const connPhones = open.map((row) => row.phoneNumberId).filter((id): id is string => Boolean(id));
    const listIds = inboxQueryPhoneIds(tenant.tenantId, connPhones, selectedPhone);
    if (!enabledIds.length || (selectedPhone && !listIds.length)) {
      return {
        connected: true,
        poll: readMetaInboxPollMs(),
        conversations: [],
        channels: [] as MetaInboxChannelPublic[],
        selectedPhoneNumberId: selectedPhone || null,
        unreadCount: 0,
        page: { limit, offset, hasMore: false },
      };
    }
    const rows = await this.conversations.listForInbox({
      tenantId: tenant.tenantId,
      filter,
      assignedTo: auth.email,
      phoneNumberId: null,
      includePhoneNumberIds: listIds,
      limit: limit + 1,
      offset,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const unreadRows = await this.conversations.listUnreadByPhone(tenant.tenantId);
    const unreadByPhone = new Map<string, number>();
    let unreadAll = 0;
    for (const item of unreadRows) {
      if (!item.phoneNumberId || !listIds.includes(item.phoneNumberId)) continue;
      unreadAll += item.unreadCount;
      unreadByPhone.set(item.phoneNumberId, (unreadByPhone.get(item.phoneNumberId) || 0) + item.unreadCount);
    }
    const channelIds = new Set<string>(enabledIds);
    const channels: MetaInboxChannelPublic[] = Array.from(channelIds).map((id) => {
      const snap = channelsById.get(id);
      const matching = open.find((row) => String(row.phoneNumberId || "") === id) || connection;
      const isConnection = id === String(matching.phoneNumberId || "");
      return {
        phoneNumberId: id,
        name: channelLabel(snap, verifiedByPhone.get(id) || (isConnection ? matching.verifiedName : null)),
        displayPhoneNumber: snap?.displayPhoneNumber || (isConnection ? matching.displayPhoneNumber : null),
        profilePictureUrl: snap?.profilePictureUrl || null,
        unreadCount: unreadByPhone.get(id) || 0,
      };
    });
    const poll = readMetaInboxPollMs();
    const byConn = new Map(open.map((row) => [row.id, row]));
    logMetaInbox("LIST", { tenantId: tenant.tenantId, filter, count: page.length });
    return {
      connected: true,
      poll,
      conversations: page.map((row) => {
        const origin = byConn.get(row.connectionId) || connection;
        return withChannel(row, channelsById, origin.displayPhoneNumber, origin.verifiedName, verifiedByPhone);
      }),
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
    const open = await this.inboxConnections(tenant.tenantId);
    const row = await this.requireOwnedConversation(tenant.tenantId, conversationId);
    const origin = open.find((item) => item.id === row.connectionId) || open[0];
    const limit = Math.min(80, Math.max(1, clampPage(query?.limit, 80, 80) || 80));
    const messages = await this.messages.listByConversation(tenant.tenantId, row.id, limit);
    logMetaInbox("THREAD", { tenantId: tenant.tenantId, count: messages.length });
    const verifiedByPhone = verifiedNamesByPhone(open);
    const snapshots = listPhoneInboxChannels(tenant.tenantId, verifiedByPhone);
    const channelsById = new Map(snapshots.map((item) => [item.phoneNumberId, item]));
    return {
      conversation: withChannel(
        row,
        channelsById,
        origin.displayPhoneNumber,
        origin.verifiedName,
        verifiedByPhone,
      ),
      messages: messages.map(toPublicInboxMessage),
    };
  }

  async markRead(auth: WabaRequestAuth, conversationId: string) {
    const tenant = requireTenant(auth);
    await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
    await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
    await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
    const row = await this.requireOwnedConversation(tenant.tenantId, conversationId);
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
