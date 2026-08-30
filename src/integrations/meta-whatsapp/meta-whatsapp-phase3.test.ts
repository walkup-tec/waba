import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { randomBytes } from "node:crypto";
import { MetaWhatsappConnectionService, stripMetaSecrets } from "./meta-whatsapp-connection.service";
import { MetaWhatsappError, toPublicMetaError } from "./meta-whatsapp-errors";
import { deriveStableMetaTenantId } from "./meta-whatsapp-tenant";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";
import type { AttachClaimedAssetsInput, UpsertPendingTokenInput } from "./meta-whatsapp-connection.repository";

class FakeMetaRepo {
  rows: MetaWhatsappConnectionRecord[] = [];
  upsertCalls = 0;
  lastEncrypted: string | null = null;

  async findOpenByTenant(tenantId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const rows = await this.listOpenByTenant(tenantId);
    return rows[0] ?? null;
  }

  async listOpenByTenant(tenantId: string): Promise<MetaWhatsappConnectionRecord[]> {
    return this.rows.filter(
      (row) =>
        row.tenantId === tenantId &&
        !row.disconnectedAt &&
        (row.status === "pending_token" ||
          row.status === "pending_confirmation" ||
          row.status === "connected"),
    );
  }

  async findByBusinessId(tenantId: string, businessId: string): Promise<MetaWhatsappConnectionRecord | null> {
    const bm = String(businessId || "").trim();
    if (!bm) return null;
    return (
      this.rows.find(
        (row) => row.tenantId === tenantId && row.metaBusinessId === bm && !row.disconnectedAt,
      ) || null
    );
  }

  async latestPendingToken(tenantId: string): Promise<MetaWhatsappConnectionRecord | null> {
    return (
      this.rows
        .filter((row) => row.tenantId === tenantId && row.status === "pending_token" && !row.disconnectedAt)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null
    );
  }

  async findByIdForTenant(tenantId: string, id: string): Promise<MetaWhatsappConnectionRecord | null> {
    return this.rows.find((row) => row.tenantId === tenantId && row.id === id) || null;
  }

  async upsertPendingToken(input: UpsertPendingTokenInput): Promise<MetaWhatsappConnectionRecord> {
    this.upsertCalls += 1;
    this.lastEncrypted = input.accessTokenEncrypted;
    const existingBm = String(input.metaBusinessId || "").trim();
    let existing = existingBm ? await this.findByBusinessId(input.tenantId, existingBm) : null;
    if (!existing) existing = await this.latestPendingToken(input.tenantId);
    if (existing && existing.status === "connected") {
      const rowBm = String(existing.metaBusinessId || "").trim();
      if (rowBm && existingBm && rowBm !== existingBm) existing = null;
      else if (rowBm && !existingBm) existing = null;
    }
    const now = new Date().toISOString();
    if (existing) {
      existing.accessTokenEncrypted = input.accessTokenEncrypted;
      existing.ownerEmail = input.ownerEmail;
      existing.status = existing.wabaId ? "pending_confirmation" : "pending_token";
      existing.updatedAt = now;
      return existing;
    }
    const row: MetaWhatsappConnectionRecord = {
      id: `conn-${this.rows.length + 1}`,
      tenantId: input.tenantId,
      ownerEmail: input.ownerEmail,
      metaBusinessId: input.metaBusinessId || null,
      wabaId: null,
      phoneNumberId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      accessTokenEncrypted: input.accessTokenEncrypted,
      tokenType: input.tokenType || "bearer",
      tokenExpiresAt: input.tokenExpiresAt || null,
      configId: input.configId || null,
      status: "pending_token",
      qualityRating: null,
      messagingLimit: null,
      lastTokenValidationAt: null,
      lastWebhookAt: null,
      lastError: null,
      createdBy: input.actorEmail,
      updatedBy: input.actorEmail,
      createdAt: now,
      updatedAt: now,
      connectedAt: null,
      disconnectedAt: null,
    };
    this.rows.push(row);
    return row;
  }

  async attachClaimedAssets(
    tenantId: string,
    connectionId: string,
    input: AttachClaimedAssetsInput,
  ): Promise<MetaWhatsappConnectionRecord> {
    const row = await this.findByIdForTenant(tenantId, connectionId);
    if (!row) throw new Error("not found");
    row.wabaId = input.wabaId || row.wabaId;
    row.phoneNumberId = input.phoneNumberId || row.phoneNumberId;
    row.metaBusinessId = input.metaBusinessId || row.metaBusinessId;
    row.displayPhoneNumber = input.displayPhoneNumber || row.displayPhoneNumber;
    row.verifiedName = input.verifiedName || row.verifiedName;
    row.status = row.wabaId ? "pending_confirmation" : row.status;
    return row;
  }

  async markConnected(
    tenantId: string,
    connectionId: string,
    patch: {
      displayPhoneNumber?: string | null;
      verifiedName?: string | null;
      qualityRating?: string | null;
      actorEmail: string;
    },
  ): Promise<MetaWhatsappConnectionRecord | null> {
    const row = await this.findByIdForTenant(tenantId, connectionId);
    if (!row) return null;
    row.status = "connected";
    row.connectedAt = new Date().toISOString();
    row.lastTokenValidationAt = row.connectedAt;
    row.lastError = null;
    row.displayPhoneNumber = patch.displayPhoneNumber || row.displayPhoneNumber;
    row.verifiedName = patch.verifiedName || row.verifiedName;
    row.qualityRating = patch.qualityRating || row.qualityRating;
    row.updatedBy = patch.actorEmail;
    row.disconnectedAt = null;
    return row;
  }
}

const authA: WabaRequestAuth = { email: "tenant-a@exemplo.com", role: "subscriber" };
const authB: WabaRequestAuth = { email: "tenant-b@exemplo.com", role: "subscriber" };
const guest: WabaRequestAuth = { email: "", role: "guest" };

const oauthOk = {
  exchangeEmbeddedSignupCode: async () => ({
    accessToken: "EAAB-secret-token-value",
    tokenType: "bearer",
    expiresIn: 3600,
  }),
};

const oauthFail = {
  exchangeEmbeddedSignupCode: async () => {
    const error = new Error("Falha ao trocar código por token na Meta.") as Error & { detail?: string };
    error.detail = "OAuthException access_token debug";
    throw error;
  },
};

describe("meta-whatsapp phase 3", () => {
  const previous = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    configId: process.env.META_CONFIG_ID,
    enc: process.env.META_TOKEN_ENCRYPTION_KEY,
    businessId: process.env.META_BUSINESS_ID,
  };

  before(() => {
    process.env.META_APP_ID = "1279182514183979";
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_CONFIG_ID = "1467449278208212";
    process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  });

  after(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore("META_APP_ID", previous.appId);
    restore("META_APP_SECRET", previous.appSecret);
    restore("META_CONFIG_ID", previous.configId);
    restore("META_TOKEN_ENCRYPTION_KEY", previous.enc);
    restore("META_BUSINESS_ID", previous.businessId);
  });

  it("usuário autenticado consegue iniciar o fluxo", () => {
    const service = new MetaWhatsappConnectionService(new FakeMetaRepo() as any, oauthOk);
    const started = service.startAuthenticatedFlow(authA);
    assert.equal(started.ok, true);
    assert.equal(started.appId, "1279182514183979");
    assert.equal(started.configId, "1467449278208212");
    const json = JSON.stringify(started);
    assert.doesNotMatch(json, /test-app-secret|EAAB|access_token|accessToken/);
  });

  it("usuário não autenticado não consegue concluir conexão", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    await assert.rejects(
      () => service.exchangeCodeAndStore(guest, { code: "abc" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "unauthenticated",
    );
    await assert.rejects(
      () => service.attachSessionAssets(guest, { wabaId: "123" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "unauthenticated",
    );
    assert.equal(repo.upsertCalls, 0);
    assert.equal(repo.rows.length, 0);
  });

  it("token nunca aparece na resposta pública", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    const result = await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    const json = JSON.stringify(result);
    assert.equal("accessToken" in result, false);
    assert.doesNotMatch(json, /EAAB-secret-token-value|access_token|encrypted_token|system_user_token/);
    assert.equal(String(repo.lastEncrypted || "").startsWith("v1:"), true);
    assert.notEqual(repo.lastEncrypted, "EAAB-secret-token-value");
  });

  it("exchange não grava META_BUSINESS_ID do env como business do cliente", async () => {
    process.env.META_BUSINESS_ID = "999999999999999";
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    assert.equal(repo.rows[0].metaBusinessId, null);
    const claimed = await service.attachSessionAssets(authA, {
      wabaId: "waba-incoming",
      phoneNumberId: "phone-incoming",
      businessId: "1041827648719609",
    });
    assert.equal(claimed.businessId, "1041827648719609");
    assert.equal(claimed.wabaId, "waba-incoming");
  });

  it("segundo portfólio não sobrescreve token nem WABA do primeiro", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    await service.attachSessionAssets(authA, {
      wabaId: "1247508354180311",
      phoneNumberId: "phone-drax",
      businessId: "1041827648719609",
      displayPhoneNumber: "+55 51 8200-1279",
      verifiedName: "Drax Tecnologia e Sistemas",
    });
    repo.rows[0].status = "connected";
    const firstToken = repo.rows[0].accessTokenEncrypted;
    await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    assert.equal(repo.rows.length, 2);
    assert.equal(repo.rows[0].accessTokenEncrypted, firstToken);
    assert.equal(repo.rows[0].wabaId, "1247508354180311");
    await service.attachSessionAssets(authA, {
      wabaId: "waba-walkup",
      phoneNumberId: "phone-walkup",
      businessId: "4141369862822598",
      displayPhoneNumber: "+55 11 95213-7761",
      verifiedName: "Grupo Walkup",
    });
    assert.equal(repo.rows[0].wabaId, "1247508354180311");
    assert.equal(repo.rows[0].metaBusinessId, "1041827648719609");
    assert.equal(repo.rows[1].wabaId, "waba-walkup");
    assert.equal(repo.rows[1].metaBusinessId, "4141369862822598");
  });

  it("conexão é associada ao tenant da sessão, não ao body", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    const spoofTenant = deriveStableMetaTenantId("intruso@exemplo.com");
    const result = await service.exchangeCodeAndStore(authA, {
      code: "ok-code",
      tenantId: spoofTenant,
      ownerEmail: "intruso@exemplo.com",
    });
    const expectedTenant = deriveStableMetaTenantId("tenant-a@exemplo.com");
    assert.equal(repo.rows.length, 1);
    assert.equal(repo.rows[0].tenantId, expectedTenant);
    assert.notEqual(repo.rows[0].tenantId, spoofTenant);
    assert.equal(repo.rows[0].ownerEmail, "tenant-a@exemplo.com");
    assert.equal(result.status, "pending_token");
  });

  it("dois tenants diferentes não acessam a mesma conexão", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    await service.attachSessionAssets(authA, {
      wabaId: "waba-a",
      phoneNumberId: "phone-a",
      businessId: "biz-a",
    });
    const statusB = await service.getPublicStatus(authB);
    assert.equal(statusB.connected, false);
    assert.equal(statusB.wabaId, null);
    assert.equal(statusB.uiStatus, "nao_conectado");
    const idA = repo.rows[0].id;
    const asB = await repo.findByIdForTenant(deriveStableMetaTenantId("tenant-b@exemplo.com"), idA);
    assert.equal(asB, null);
    await assert.rejects(
      () => service.attachSessionAssets(authB, { wabaId: "waba-a" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "no_pending_connection",
    );
  });

  it("cancelamento (code ausente) não cria conexão inválida", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    await assert.rejects(
      () => service.exchangeCodeAndStore(authA, { code: "" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "code_missing",
    );
    assert.equal(repo.upsertCalls, 0);
    assert.equal(repo.rows.length, 0);
  });

  it("erro da Meta não grava token", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthFail);
    await assert.rejects(
      () => service.exchangeCodeAndStore(authA, { code: "bad-code" }),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "exchange_failed",
    );
    assert.equal(repo.upsertCalls, 0);
    assert.equal(repo.rows.length, 0);
    assert.equal(repo.lastEncrypted, null);
  });

  it("resposta pública e erros não contém campos sensíveis", async () => {
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    const stored = await service.exchangeCodeAndStore(authA, { code: "ok-code" });
    const claimed = await service.attachSessionAssets(authA, {
      wabaId: "111",
      phoneNumberId: "222",
      businessId: "333",
    });
    assert.equal(claimed.status, "pending_confirmation");
    assert.equal(claimed.uiStatus, "aguardando_confirmacao");
    assert.equal(claimed.connected, false);
    for (const payload of [stored, claimed, toPublicMetaError(new MetaWhatsappError("exchange_failed"))]) {
      const cleaned = stripMetaSecrets({
        ...payload,
        accessToken: "should-be-removed",
        detail: "stack or oauth body",
      });
      const json = JSON.stringify(cleaned);
      assert.doesNotMatch(json, /EAAB|should-be-removed|app_secret|encrypted_token/);
      assert.equal("accessToken" in cleaned, false);
    }
  });

  it("config inválida impede iniciar e persistir", () => {
    const prev = process.env.META_APP_SECRET;
    delete process.env.META_APP_SECRET;
    const repo = new FakeMetaRepo();
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk);
    assert.throws(
      () => service.startAuthenticatedFlow(authA),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "config_invalid",
    );
    if (prev === undefined) process.env.META_APP_SECRET = "test-app-secret";
    else process.env.META_APP_SECRET = prev;
    process.env.META_APP_SECRET = "test-app-secret";
  });

  it("Graph validation marca connected só com WABA e Phone da mesma conta", async () => {
    const repo = new FakeMetaRepo();
    const graphCalls: string[] = [];
    const graph = async (input: { path: string }) => {
      graphCalls.push(input.path);
      if (input.path === "waba-1") {
        return { ok: true, status: 200, json: { id: "waba-1" } };
      }
      return {
        ok: true,
        status: 200,
        json: {
          id: "phone-1",
          display_phone_number: "+15550001111",
          verified_name: "Loja",
          quality_rating: "GREEN",
          whatsapp_business_account: { id: "waba-1" },
        },
      };
    };
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk, graph as any);
    await service.exchangeCodeAndStore(authA, { code: "AUTH_CODE" });
    await service.attachSessionAssets(authA, {
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      businessId: "bm-1",
    });
    const confirmed = await service.confirmFromAuth(authA);
    assert.equal(confirmed.status, "connected");
    assert.equal(confirmed.connected, true);
    assert.equal(confirmed.qualityRating, "GREEN");
    assert.equal(confirmed.verifiedName, "Loja");
    assert.deepEqual(graphCalls, ["waba-1", "phone-1"]);
    const again = await service.confirmFromAuth(authA);
    assert.equal(again.status, "connected");
    assert.equal(graphCalls.length, 2);
  });

  it("Graph 401 não marca connected", async () => {
    const repo = new FakeMetaRepo();
    const graph = async () => ({ ok: false, status: 401, json: { error: { message: "invalid" } } });
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk, graph as any);
    await service.exchangeCodeAndStore(authA, { code: "AUTH_CODE" });
    await service.attachSessionAssets(authA, { wabaId: "waba-1", phoneNumberId: "phone-1" });
    await assert.rejects(
      () => service.confirmFromAuth(authA),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "invalid_token",
    );
    assert.equal(repo.rows[0].status, "pending_confirmation");
  });

  it("Phone de outra WABA não marca connected", async () => {
    const repo = new FakeMetaRepo();
    const graph = async (input: { path: string }) => {
      if (input.path === "waba-1") return { ok: true, status: 200, json: { id: "waba-1" } };
      return {
        ok: true,
        status: 200,
        json: {
          id: "phone-1",
          whatsapp_business_account: { id: "outra-waba" },
        },
      };
    };
    const service = new MetaWhatsappConnectionService(repo as any, oauthOk, graph as any);
    await service.exchangeCodeAndStore(authA, { code: "AUTH_CODE" });
    await service.attachSessionAssets(authA, { wabaId: "waba-1", phoneNumberId: "phone-1" });
    await assert.rejects(
      () => service.confirmFromAuth(authA),
      (error: unknown) => error instanceof MetaWhatsappError && error.code === "persist_failed",
    );
    assert.equal(repo.rows[0].status, "pending_confirmation");
  });
});
