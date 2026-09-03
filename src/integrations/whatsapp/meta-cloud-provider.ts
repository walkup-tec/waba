import type { MetaWhatsappConnectionRecord } from "../meta-whatsapp/meta-whatsapp-connection.types";
import { MetaWhatsappConnectionRepository } from "../meta-whatsapp/meta-whatsapp-connection.repository";
import { decryptMetaToken } from "../meta-whatsapp/meta-token-crypto";
import {
  postMetaCloudMessage,
  type MetaGraphMessagesCaller,
} from "../meta-whatsapp/meta-whatsapp-graph-messages.client";
import { MetaWhatsappError } from "../meta-whatsapp/meta-whatsapp-errors";
import {
  publicMetaGraphSendMessage,
  safePublicGraphTemplateDetail,
} from "../meta-whatsapp/meta-whatsapp-graph-errors";
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
    const connection = await this.requireConnected(
      input.tenantId,
      input.connectionId,
      input.phoneNumberId,
    );
    return this.dispatch(connection, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient.waId,
      type: "text",
      text: { preview_url: false, body: text },
    }, input.phoneNumberId);
  }

  async sendTemplate(input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult> {
    const name = String(input.templateName || "").trim();
    const language = normalizeTemplateLanguage(input.language);
    if (!name || !language) throw new MetaWhatsappError("invalid_payload");
    const recipient = normalizeCloudApiRecipient(input.to);
    if (!recipient.ok) throw new MetaWhatsappError("invalid_recipient");
    const connection = await this.requireConnected(
      input.tenantId,
      input.connectionId,
      input.phoneNumberId,
    );
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
    }, input.phoneNumberId);
  }

  async requireConnected(
    tenantId: string,
    connectionId?: string,
    phoneNumberId?: string,
  ): Promise<MetaWhatsappConnectionRecord> {
    let row: MetaWhatsappConnectionRecord | null = null;
    const phone = String(phoneNumberId || "").trim();
    if (phone) {
      row = await this.connections.findConnectedByPhoneNumberId(phone);
      const usableByPhone =
        Boolean(row) &&
        row!.tenantId === tenantId &&
        !row!.disconnectedAt &&
        (row!.status === "connected" || row!.status === "pending_confirmation");
      if (usableByPhone && row) return row;
      row = null;
    }
    if (connectionId) {
      row = await this.connections.findByIdForTenant(tenantId, connectionId);
      const usable =
        Boolean(row) &&
        row!.tenantId === tenantId &&
        !row!.disconnectedAt &&
        Boolean(row!.phoneNumberId) &&
        (row!.status === "connected" || row!.status === "pending_confirmation");
      if (!usable || !row) throw new MetaWhatsappError("not_connected");
      return row;
    }
    row = await this.connections.findConnectedByTenant(tenantId);
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
    phoneNumberId?: string,
  ): Promise<WhatsAppSendResult> {
    let token = "";
    try {
      token = this.decrypt(connection.accessTokenEncrypted);
    } catch {
      throw new MetaWhatsappError("invalid_token");
    }
    const sendPhone = String(phoneNumberId || connection.phoneNumberId || "").trim();
    if (!sendPhone) throw new MetaWhatsappError("not_connected");
    const result = await this.graph({
      token,
      phoneNumberId: sendPhone,
      body,
    });
    if (!result.ok) {
      if (result.status === 401) throw new MetaWhatsappError("invalid_token");
      const error = new MetaWhatsappError("send_failed") as MetaWhatsappError & {
        graphStatus?: number;
        graphKind?: string;
        graphCode?: string | null;
      };
      error.graphStatus = result.status;
      error.graphKind = result.kind;
      error.graphCode = result.graphCode;
      const detail = safePublicGraphTemplateDetail(result.json);
      error.message = detail || publicMetaGraphSendMessage(result.kind, result.status);
      throw error;
    }
    return {
      provider: this.name,
      messageId: result.wamid,
      status: "accepted",
      connectionId: connection.id,
      phoneNumberId: sendPhone,
    };
  }
}
