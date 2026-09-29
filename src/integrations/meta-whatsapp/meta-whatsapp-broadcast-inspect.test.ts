import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import { MetaWhatsappError } from "./meta-whatsapp-errors";
import {
  isOfficialSendConnection,
  isOfficialWabaConnection,
  type MetaWhatsappConnectionRecord,
} from "./meta-whatsapp-connection.types";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaTemplateRecord } from "./meta-whatsapp-template.types";
import { MetaWhatsappBroadcastService } from "./meta-whatsapp-broadcast.service";
import { MetaCloudProvider } from "../whatsapp/meta-cloud-provider";

const EMAIL = "flaviane-broadcast-inspect@example.com";
const TENANT = deriveStableMetaTenantId(EMAIL);
const CONN_ID = "44493911-2c56-463d-9056-20282635f54b";
const TPL_ID = "d942e085-3c0f-4912-8d37-78c3af3ca0ef";
const WABA_ID = "2301051607405249";

function auth(): WabaRequestAuth {
  return { email: EMAIL, role: "subscriber" };
}

function connection(overrides: Partial<MetaWhatsappConnectionRecord> = {}): MetaWhatsappConnectionRecord {
  return {
    id: CONN_ID,
    tenantId: TENANT,
    ownerEmail: EMAIL,
    metaBusinessId: "60845972",
    wabaId: WABA_ID,
    phoneNumberId: "phone-flaviane",
    displayPhoneNumber: "5551999000000",
    verifiedName: "Flaviane",
    accessTokenEncrypted: "v1:enc-flaviane",
    tokenType: "bearer",
    tokenExpiresAt: null,
    configId: "cfg",
    status: "pending_token",
    qualityRating: null,
    messagingLimit: null,
    lastTokenValidationAt: null,
    lastWebhookAt: null,
    lastError: null,
    createdBy: EMAIL,
    updatedBy: EMAIL,
    createdAt: "2026-09-02T10:00:00.000Z",
    updatedAt: "2026-09-02T10:00:00.000Z",
    connectedAt: null,
    disconnectedAt: null,
    ...overrides,
  };
}

function template(overrides: Partial<MetaTemplateRecord> = {}): MetaTemplateRecord {
  return {
    id: TPL_ID,
    tenantId: TENANT,
    connectionId: CONN_ID,
    wabaId: WABA_ID,
    metaTemplateId: "meta-tpl",
    name: "aviso_utilidade",
    language: "pt_BR",
    category: "UTILITY",
    status: "APPROVED",
    qualityScore: "GREEN",
    components: [{ type: "BODY", text: "Olá, {{1}}." }],
    rejectedReason: null,
    lastSyncedAt: "2026-09-29T12:00:00.000Z",
    createdAt: "2026-09-29T12:00:00.000Z",
    updatedAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

function inspectService(row: MetaWhatsappConnectionRecord, tpl = template()) {
  return new MetaWhatsappBroadcastService(
    {
      findByIdForTenant: async () => row,
    } as never,
    {
      findByIdForTenant: async () => tpl,
    } as never,
    {} as never,
    {} as never,
    () => {
      throw new Error("inspect usa o template local neste teste");
    },
  );
}

describe("conexão oficial do Disparo Cloud", () => {
  it("pending_token com WABA da BM convidada é card oficial", () => {
    const row = connection();
    assert.equal(isOfficialWabaConnection(row, TENANT), true);
    assert.equal(isOfficialSendConnection(row, TENANT), true);
  });

  it("pending_token sem WABA continua fora", () => {
    const row = connection({ wabaId: null });
    assert.equal(isOfficialWabaConnection(row, TENANT), false);
  });

  it("pending_token sem token não envia, mas inspeciona se tem WABA", () => {
    const row = connection({ accessTokenEncrypted: "" });
    assert.equal(isOfficialWabaConnection(row, TENANT), true);
    assert.equal(isOfficialSendConnection(row, TENANT), false);
  });
});

describe("inspect do Disparo Cloud na BM convidada", () => {
  it("lê template aprovado no card pending_token da Flaviane", async () => {
    const result = await inspectService(connection()).inspectFromAuth(auth(), {
      connectionId: CONN_ID,
      templateId: TPL_ID,
    });
    assert.equal(result.connectionId, CONN_ID);
    assert.equal(result.templateId, TPL_ID);
    assert.equal(result.templateName, "aviso_utilidade");
    assert.equal(result.mapping.nome, true);
  });

  it("connected continua inspecionando", async () => {
    const result = await inspectService(connection({ status: "connected" })).inspectFromAuth(auth(), {
      connectionId: CONN_ID,
      templateId: TPL_ID,
    });
    assert.equal(result.templateName, "aviso_utilidade");
  });

  it("pending_token sem WABA continua not_connected", async () => {
    await assert.rejects(
      () =>
        inspectService(connection({ wabaId: null })).inspectFromAuth(auth(), {
          connectionId: CONN_ID,
          templateId: TPL_ID,
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });

  it("outro tenant continua not_connected", async () => {
    await assert.rejects(
      () =>
        inspectService(connection({ tenantId: "outro-tenant" })).inspectFromAuth(auth(), {
          connectionId: CONN_ID,
          templateId: TPL_ID,
        }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });
});

describe("envio Cloud no card pending_token", () => {
  it("preferConnectionToken usa o token do card Flaviane", async () => {
    const row = connection({ phoneNumberId: null });
    const provider = new MetaCloudProvider({
      findByIdForTenant: async () => row,
    } as never);
    const got = await provider.requireConnected(TENANT, CONN_ID, "phone-da-tela", {
      preferConnectionToken: true,
    });
    assert.equal(got.id, CONN_ID);
    assert.equal(got.status, "pending_token");
  });

  it("pending_token sem token continua not_connected no envio", async () => {
    const provider = new MetaCloudProvider({
      findByIdForTenant: async () => connection({ accessTokenEncrypted: "" }),
    } as never);
    await assert.rejects(
      () => provider.requireConnected(TENANT, CONN_ID, "phone-da-tela", { preferConnectionToken: true }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "not_connected",
    );
  });
});
