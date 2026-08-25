export type MetaInboxEventName =
  | "inbound_message"
  | "outbound_message"
  | "conversation_created"
  | "conversation_updated";

export type MetaInboxEvent = {
  name: MetaInboxEventName;
  tenantId: string;
  conversationId: string;
  messageId?: string;
  connectionId: string;
  occurredAt: string;
};

type Listener = (event: MetaInboxEvent) => void | Promise<void>;

const listeners: Record<MetaInboxEventName, Listener[]> = {
  inbound_message: [],
  outbound_message: [],
  conversation_created: [],
  conversation_updated: [],
};

export function onInboundMessage(listener: Listener): () => void {
  return subscribe("inbound_message", listener);
}

export function onOutboundMessage(listener: Listener): () => void {
  return subscribe("outbound_message", listener);
}

export function onConversationCreated(listener: Listener): () => void {
  return subscribe("conversation_created", listener);
}

export function onConversationUpdated(listener: Listener): () => void {
  return subscribe("conversation_updated", listener);
}

function subscribe(name: MetaInboxEventName, listener: Listener): () => void {
  listeners[name].push(listener);
  return () => {
    listeners[name] = listeners[name].filter((item) => item !== listener);
  };
}

export async function emitMetaInboxEvent(event: MetaInboxEvent): Promise<void> {
  const list = listeners[event.name].slice();
  for (const listener of list) {
    try {
      await listener(event);
    } catch {
      // Chatbot/IA futuros não podem derrubar webhook nem envio.
    }
  }
}

export function resetMetaInboxListenersForTests(): void {
  (Object.keys(listeners) as MetaInboxEventName[]).forEach((key) => {
    listeners[key] = [];
  });
}
