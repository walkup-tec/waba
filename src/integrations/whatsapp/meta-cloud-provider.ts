import type { MetaWhatsappConnectionRecord } from "../meta-whatsapp/meta-whatsapp-connection.types";
import { MetaWhatsappConnectionRepository } from "../meta-whatsapp/meta-whatsapp-connection.repository";
import { decryptMetaToken } from "../meta-whatsapp/meta-token-crypto";
import {
  postMetaCloudMessage,
  type MetaGraphMessagesCaller,
} from "../meta-whatsapp/meta-whatsapp-graph-messages.client";
import { MetaWhatsappError } from "../meta-whatsapp/meta-whatsapp-errors";
import { publicMetaGraphSendMessage } from "../meta-whatsapp/meta-whatsapp-graph-errors";
import type {
  WhatsAppProvider,
  WhatsAppProviderName,
  WhatsAppSendResult,
  WhatsAppSendTemplateInput,
  WhatsAppSendTextInput,
  WhatsAppTemplateComponent,
} from "./whatsapp-provider";
import {
  normalizeCloudApiRecipient,
  normalizeTemplateLanguage,
} from "../meta-whatsapp/meta-whatsapp-recipient";

function sanitizeTemplateComponents(
  input: WhatsAppTemplateComponent[] | undefined,
): WhatsAppTemplateComponent[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((item) => {
    const row = item && typeof item === "object" ? item : { type: "body" };
    const out: WhatsAppTemplateComponent = {
      type: String(row.type || "body").trim() || "body",
    };
    if (Array.isArray(row.parameters)) out.parameters = row.parameters.slice(0, 20);
    if (row.sub_type) out.sub_type = String(row.sub_type).slice(0, 40);
    if (row.index !== undefined) out.index = row.index;
    return out;
  });
}

export class MetaCloudProvider implements WhatsAppProvider {
  readonly name: WhatsAppProviderName = "meta-cloud";

  constructor(
    private readonly connections = new MetaWhatsappConnectionRepository(),
    private readonly graph: MetaGraphMessagesCaller = (input) => postMetaCloudMessage(input),
    private readonly decrypt = decryptMetaToken,
  ) {}

  async sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    const text = String(input.text || "").trim();
    if (!text) throw new MetaWhatsappError("invalid_payload");
    if (text.length > 4096) throw new MetaWhatsappError("invalid_payload");
    const recipient = normalizeCloudApiRecipient(input.to);
    if (!recipient.ok) throw new MetaWhatsappError("invalid_recipient");
    const connection = await this.requireConnected(input.tenantId, input.connectionId);
    return this.dispatch(connection, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient.waId,
      type: "text",
      text: { preview_url: false, body: text },
    });
  }

  async sendTemplate(input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult> {
    const name = String(input.templateName || "").trim();
    const language = normalizeTemplateLanguage(input.language);
    if (!name || !language) throw new MetaWhatsappError("invalid_payload");
    const recipient = normalizeCloudApiRecipient(input.to);
    if (!recipient.ok) throw new MetaWhatsappError("invalid_recipient");
    const connection = await this.requireConnected(input.tenantId, input.connectionId);
    const template: Record<string, unknown> = {
      name,
      language: { code: language },
    };
    const components = sanitizeTemplateComponents(input.components);
    if (components.length) template.components = components;
    return this.dispatch(connection, {
      messaging_product: "whatsapp",
      to: recipient.waId,
      type: "template",
      template,
    });
  }

  async requireConnected(
    tenantId: string,
    connectionId?: string,
  ): Promise<MetaWhatsappConnectionRecord> {
    let row: MetaWhatsappConnectionRecord | null = null;
    if (connectionId) {
      row = await this.connections.findByIdForTenant(tenantId, connectionId);
    } else {
      row = await this.connections.findConnectedByTenant(tenantId);
    }
    if (!row || row.status !== "connected" || !row.phoneNumberId) {
      throw new MetaWhatsappError("not_connected");
    }
    if (row.tenantId !== tenantId) {
      throw new MetaWhatsappError("not_connected");
    }
    return row;
  }

  private async dispatch(
    connection: MetaWhatsappConnectionRecord,
    body: Record<string, unknown>,
  ): Promise<WhatsAppSendResult> {
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const result = await this.graph({
      token,
      phoneNumberId: String(connection.phoneNumberId),
      body,
    });
    if (!result.ok) {
      if (result.status === 401) throw new MetaWhatsappError("invalid_token");
      const error = new MetaWhatsappError("send_failed");
      (error as MetaWhatsappError & { graphStatus?: number; graphKind?: string }).graphStatus =
        result.status;
      (error as MetaWhatsappError & { graphStatus?: number; graphKind?: string }).graphKind =
        result.kind;
      error.message = publicMetaGraphSendMessage(result.kind, result.status);
      throw error;
    }
    return {
      provider: this.name,
      messageId: result.wamid,
      status: "accepted",
      connectionId: connection.id,
      phoneNumberId: String(connection.phoneNumberId),
    };
  }
}
