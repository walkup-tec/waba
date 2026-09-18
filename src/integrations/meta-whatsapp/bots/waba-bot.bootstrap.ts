import { onInboundMessage } from "../meta-whatsapp-inbox-events";
import { WabaBotInboundService } from "./waba-bot-inbound.service";

let started = false;
let unsubscribe: (() => void) | null = null;

/**
 * Assina inbound_message depois do persist. Não vive no handler HTTP do webhook.
 */
export function startWabaBots(service?: WabaBotInboundService): void {
  if (started) return;
  started = true;
  const instance = service || new WabaBotInboundService();
  unsubscribe = onInboundMessage(async (event) => {
    await instance.handleInbound(event);
  });
}

export function stopWabaBotsForTests(): void {
  started = false;
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}
