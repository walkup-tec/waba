export type WhatsAppProviderName = "meta-cloud" | "evolution";

export type WhatsAppSendTextInput = {
  tenantId: string;
  to: string;
  text: string;
  connectionId?: string;
};

export type WhatsAppTemplateComponent = {
  type: string;
  parameters?: unknown[];
  sub_type?: string;
  index?: string | number;
};

export type WhatsAppSendTemplateInput = {
  tenantId: string;
  to: string;
  templateName: string;
  language: string;
  components?: WhatsAppTemplateComponent[];
  connectionId?: string;
};

export type WhatsAppSendResult = {
  provider: WhatsAppProviderName;
  messageId: string | null;
  status: string;
  connectionId: string;
  phoneNumberId: string;
};

/**
 * Contrato comum de envio WhatsApp.
 * Evolution continua nos fluxos atuais (aquecedor, disparos) e NÃO é roteada por aqui.
 */
export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult>;
  sendTemplate(input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult>;
}
