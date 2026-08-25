import type {
  WhatsAppProvider,
  WhatsAppProviderName,
  WhatsAppSendResult,
  WhatsAppSendTemplateInput,
  WhatsAppSendTextInput,
} from "./whatsapp-provider";

/**
 * Adaptador de contrato. Os envios Evolution de produção permanecem em
 * aquecedor/disparos/index.ts. Não usar esta classe para Cloud API.
 */
export class EvolutionProvider implements WhatsAppProvider {
  readonly name: WhatsAppProviderName = "evolution";

  async sendText(_input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    throw new Error("EvolutionProvider não envia neste fluxo. Use o caminho Evolution existente.");
  }

  async sendTemplate(_input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult> {
    throw new Error("EvolutionProvider não envia templates Cloud API.");
  }
}
