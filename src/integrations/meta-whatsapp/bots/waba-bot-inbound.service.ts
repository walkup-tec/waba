import type { MetaInboxEvent } from "../meta-whatsapp-inbox-events";
import { MetaWhatsappConversationRepository } from "../meta-whatsapp-conversation.repository";
import { MetaWhatsappMessageRepository } from "../meta-whatsapp-message.repository";
import { MetaWhatsappMessagingService } from "../meta-whatsapp-messaging.service";
import { resolveCustomerCareWindow } from "../meta-whatsapp-customer-care-window";
import { logWabaBot } from "./waba-bot-log";
import {
  getBotIdForPhone,
  readBotFlow,
  readConversationBotRun,
  tryClaimBotMessage,
  writeConversationBotRun,
} from "./waba-bot.store";
import {
  advanceBotRun,
  createBotRunState,
  findStartNode,
} from "./waba-bot-runtime.engine";
import { formatNumberedMenu } from "./waba-bot-flow.normalize";
import type { BotOutboundPayload, BotRunState } from "./waba-bot.types";

const conversationBotLocks = new Map<string, Promise<unknown>>();

export async function withConversationBotLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = String(conversationId || "").trim();
  const previous = conversationBotLocks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  conversationBotLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function resetWabaBotLocksForTests(): void {
  conversationBotLocks.clear();
}

function shouldRestartRun(run: BotRunState | null | undefined, botId: string): boolean {
  if (!run) return true;
  if (run.flowId !== botId) return true;
  if (run.phase === "waiting_reply" || run.phase === "running" || run.phase === "starting") {
    return false;
  }
  return run.phase === "finished" || run.phase === "error" || run.phase === "idle";
}

function toSendText(payload: BotOutboundPayload): string {
  if (payload.type === "text") return String(payload.text || "").trim();
  if (payload.type === "interactive") {
    return formatNumberedMenu(
      payload.interactive.text,
      payload.interactive.options.map((opt) => ({ label: opt.label })),
    );
  }
  return "";
}

function toSendBody(payload: BotOutboundPayload): Record<string, unknown> | null {
  if (payload.type === "text") {
    const text = String(payload.text || "").trim();
    return text ? { type: "text", text } : null;
  }
  if (payload.type === "interactive") {
    const text = toSendText(payload);
    return text ? { type: "text", text } : null;
  }
  if (payload.type === "media") {
    const media = payload.media;
    const type = media.mediaKind === "pdf" ? "document" : media.mediaKind;
    return {
      type,
      mediaRef: media.mediaRef || "",
      mediaUrl: media.mediaUrl || "",
      caption: media.caption || "",
      mime: media.mediaMime || "",
      fileName: media.mediaFileName || String(media.mediaUrl || "").split("/").pop() || "",
      voice: media.voiceNote === true,
    };
  }
  if (payload.type === "cta_url") {
    return {
      type: "cta_url",
      text: payload.cta.text,
      buttonLabel: payload.cta.buttonLabel,
      url: payload.cta.url,
    };
  }
  return null;
}

export type WabaBotInboundDeps = {
  messages?: Pick<MetaWhatsappMessageRepository, "findByIdForTenant">;
  conversations?: Pick<MetaWhatsappConversationRepository, "findByIdForTenant" | "assign">;
  messaging?: Pick<MetaWhatsappMessagingService, "sendForTenant" | "showBotTypingForTenant">;
};

export class WabaBotInboundService {
  constructor(private readonly deps: WabaBotInboundDeps = {}) {}

  private messages() {
    return this.deps.messages || new MetaWhatsappMessageRepository();
  }

  private conversations() {
    return this.deps.conversations || new MetaWhatsappConversationRepository();
  }

  private messaging() {
    return this.deps.messaging || new MetaWhatsappMessagingService();
  }

  async handleInbound(event: MetaInboxEvent): Promise<boolean> {
    try {
      return await this.processInbound(event);
    } catch (error) {
      logWabaBot("error", {
        tenantId: event.tenantId,
        conversationId: event.conversationId,
        messageId: event.messageId || null,
        reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });
      return false;
    }
  }

  private async processInbound(event: MetaInboxEvent): Promise<boolean> {
    if (event.name !== "inbound_message") return false;
    const tenantId = String(event.tenantId || "").trim();
    const messageId = String(event.messageId || "").trim();
    const conversationId = String(event.conversationId || "").trim();
    if (!tenantId || !messageId || !conversationId) return false;

    return withConversationBotLock(`${tenantId}:${conversationId}`, async () => {
      const message = await this.messages().findByIdForTenant(tenantId, messageId);
      if (!message || message.tenantId !== tenantId || message.direction !== "inbound") {
        return false;
      }

      const conversation = await this.conversations().findByIdForTenant(tenantId, conversationId);
      if (!conversation || conversation.tenantId !== tenantId) return false;

      const phoneNumberId = String(conversation.phoneNumberId || "").trim();
      const botId = getBotIdForPhone(tenantId, phoneNumberId);
      if (!botId) {
        logWabaBot("skip", { tenantId, conversationId, reason: "no_bot_link" });
        return false;
      }

      const flow = readBotFlow(tenantId, botId);
      if (!flow || !findStartNode(flow)) {
        logWabaBot("skip", { tenantId, conversationId, reason: "flow_missing" });
        return false;
      }

      let run = readConversationBotRun(tenantId, conversationId);
      const botActive =
        run &&
        !shouldRestartRun(run, botId) &&
        (run.phase === "waiting_reply" || run.phase === "running" || run.phase === "starting");

      if (conversation.humanTakeover && !botActive) {
        logWabaBot("skip", { tenantId, conversationId, reason: "human_takeover" });
        return false;
      }

      const claim = tryClaimBotMessage({
        tenantId,
        messageId,
        conversationId,
        botId,
      });
      if (!claim.claimed) {
        logWabaBot("skip", { tenantId, conversationId, messageId, reason: "duplicate_claim" });
        return true;
      }

      const window = resolveCustomerCareWindow({ lastInboundAt: conversation.lastInboundAt });
      if (window.known && window.withinWindow === false) {
        logWabaBot("skip", { tenantId, conversationId, reason: "outside_24h_window" });
        return true;
      }

      const continueWaiting = Boolean(botActive && run?.phase === "waiting_reply");
      const inboundForAdvance = continueWaiting ? String(message.textContent || "").trim() : undefined;

      if (shouldRestartRun(run, botId)) {
        run = createBotRunState({
          flow,
          testPhone: String(conversation.contactWaId || conversation.contactPhone || ""),
        });
      }

      const inboundWamid = String(message.wamid || "").trim();
      const messaging = this.messaging();
      if (typeof messaging.showBotTypingForTenant === "function") {
        await messaging
          .showBotTypingForTenant(tenantId, {
            conversationId,
            connectionId: conversation.connectionId,
            phoneNumberId,
            inboundWamid,
          })
          .catch(() => false);
      }

      const advanced = await advanceBotRun({
        flow,
        run: run!,
        inboundText: inboundForAdvance,
        conversationId,
        phone: conversation.contactWaId,
        tenantId,
      });
      run = advanced.run;
      writeConversationBotRun(tenantId, conversationId, run);

      for (const payload of advanced.outbound) {
        const sendBody = toSendBody(payload);
        if (!sendBody) continue;
        await this.messaging().sendForTenant(tenantId, {
          ...sendBody,
          to: conversation.contactWaId,
          conversationId,
          phoneNumberId,
          connectionId: conversation.connectionId,
          source: "bot",
          inboundWamid,
        });
      }

      if (advanced.transferHuman || run.phase === "finished") {
        if (advanced.transferHuman) {
          await this.conversations().assign(tenantId, conversationId, conversation.assignedTo, true);
          writeConversationBotRun(tenantId, conversationId, { ...run, phase: "finished" });
        }
      }

      logWabaBot("handled", {
        tenantId,
        conversationId,
        messageId,
        botId,
        phase: run.phase,
        outbound: advanced.outbound.length,
      });
      return true;
    });
  }
}
