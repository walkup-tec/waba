import { onInboundMessage } from "./meta-whatsapp-inbox-events";
import { MetaWhatsappAutomationEngine } from "./meta-whatsapp-automation-engine";

let started = false;
let unsubscribe: (() => void) | null = null;

/**
 * Assina o evento interno inbound_message. Não vive no handler HTTP do webhook.
 */
export function startMetaWhatsappAutomation(engine?: MetaWhatsappAutomationEngine): void {
  if (started) return;
  started = true;
  const instance = engine || new MetaWhatsappAutomationEngine();
  unsubscribe = onInboundMessage((event) => instance.handleInbound(event));
}

export function stopMetaWhatsappAutomationForTests(): void {
  started = false;
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}
