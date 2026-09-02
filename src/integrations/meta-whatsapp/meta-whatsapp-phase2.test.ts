import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { randomBytes } from "node:crypto";
import { decryptMetaToken, encryptMetaToken, MetaTokenCryptoError } from "./meta-token-crypto";
import { deriveStableMetaTenantId, resolveMetaWhatsappTenant } from "./meta-whatsapp-tenant";
import { WABA_LABORATORIO_OWNER_EMAIL } from "../../menus/waba-laboratorio-access";
import { stripMetaSecrets, toMetaWhatsappPublicConnection } from "./meta-whatsapp-connection.service";
import type { MetaWhatsappConnectionRecord } from "./meta-whatsapp-connection.types";
import type { WabaRequestAuth } from "../../auth/waba-request-auth";

describe("meta-token-crypto", () => {
  const previous = process.env.META_TOKEN_ENCRYPTION_KEY;

  before(() => {
    process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  });

  after(() => {
    if (previous === undefined) delete process.env.META_TOKEN_ENCRYPTION_KEY;
    else process.env.META_TOKEN_ENCRYPTION_KEY = previous;
  });

  it("cifra e decifra o mesmo token", () => {
    const plain = "EAAB-test-token-value";
    const packed = encryptMetaToken(plain);
    assert.notEqual(packed, plain);
    assert.equal(packed.startsWith("v1:"), true);
    assert.equal(decryptMetaToken(packed), plain);
  });

  it("não gera o mesmo ciphertext duas vezes (IV aleatório)", () => {
    const a = encryptMetaToken("same-token");
    const b = encryptMetaToken("same-token");
    assert.notEqual(a, b);
    assert.equal(decryptMetaToken(a), "same-token");
    assert.equal(decryptMetaToken(b), "same-token");
  });

  it("rejeita envelope inválido", () => {
    assert.throws(() => decryptMetaToken("not-an-envelope"), MetaTokenCryptoError);
  });
});

describe("meta-whatsapp-tenant", () => {
  it("usa subscriber.id quando existe", () => {
    const auth: WabaRequestAuth = { email: "cliente@exemplo.com", role: "subscriber" };
    const tenant = resolveMetaWhatsappTenant(auth, {
      getByEmail: () =>
        ({
          id: "11111111-1111-1111-1111-111111111111",
          email: "cliente@exemplo.com",
        }) as any,
    } as any);
    assert.equal(tenant.tenantId, "11111111-1111-1111-1111-111111111111");
    assert.equal(tenant.ownerEmail, "cliente@exemplo.com");
  });

  it("gera tenant_id estável sem depender só do e-mail como PK", () => {
    const a = deriveStableMetaTenantId("walkup@walkuptec.com.br");
    const b = deriveStableMetaTenantId("walkup@walkuptec.com.br");
    const c = deriveStableMetaTenantId("outro@walkuptec.com.br");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f-]{36}$/i);
  });

  it("operacional com Laboratório lê o tenant do dono, não o próprio", () => {
    const repo = {
      getByEmail: (email: string) => {
        const normalized = String(email || "").trim().toLowerCase();
        if (normalized === "drax@draxsistemas.com.br") {
          return { id: "tenant-drax", email: "drax@draxsistemas.com.br" } as any;
        }
        if (normalized === WABA_LABORATORIO_OWNER_EMAIL) {
          return { id: "tenant-lab", email: WABA_LABORATORIO_OWNER_EMAIL } as any;
        }
        return null;
      },
    };
    const shared = resolveMetaWhatsappTenant(
      { email: "drax@draxsistemas.com.br", role: "operacional" },
      repo as any,
      { hasLaboratorioMenu: true },
    );
    assert.equal(shared.tenantId, "tenant-lab");
    assert.equal(shared.ownerEmail, WABA_LABORATORIO_OWNER_EMAIL);

    const isolated = resolveMetaWhatsappTenant(
      { email: "drax@draxsistemas.com.br", role: "operacional" },
      repo as any,
      { hasLaboratorioMenu: false },
    );
    assert.equal(isolated.tenantId, "tenant-drax");
    assert.equal(isolated.ownerEmail, "drax@draxsistemas.com.br");
  });
});

describe("public connection dto", () => {
  it("nunca inclui token ou secret no DTO público", () => {
    const row: MetaWhatsappConnectionRecord = {
      id: "c1",
      tenantId: "t1",
      ownerEmail: "a@b.com",
      metaBusinessId: "biz",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      displayPhoneNumber: "+55 11 99999-0000",
      verifiedName: "Empresa",
      accessTokenEncrypted: "v1:iv:tag:cipher",
      tokenType: "bearer",
      tokenExpiresAt: null,
      configId: "cfg",
      status: "pending_confirmation",
      qualityRating: null,
      messagingLimit: null,
      lastTokenValidationAt: null,
      lastWebhookAt: null,
      lastError: null,
      createdBy: "a@b.com",
      updatedBy: "a@b.com",
      createdAt: "",
      updatedAt: "",
      connectedAt: null,
      disconnectedAt: null,
    };
    const pub = toMetaWhatsappPublicConnection(row);
    const json = JSON.stringify(pub);
    assert.equal("accessToken" in pub, false);
    assert.doesNotMatch(json, /accessToken|access_token|v1:iv:tag/);
    assert.equal(pub.wabaId, "waba-1");
    assert.equal(pub.connected, false);
    assert.equal(pub.pending, true);
  });

  it("stripMetaSecrets remove chaves sensíveis em qualquer profundidade", () => {
    const cleaned = stripMetaSecrets({
      ok: true,
      accessToken: "EAABsecret",
      encrypted_token: "v1:x",
      system_user_token: "sys",
      nested: { client_secret: "x", wabaId: "123" },
    });
    assert.equal("accessToken" in cleaned, false);
    assert.equal("encrypted_token" in cleaned, false);
    assert.equal("system_user_token" in cleaned, false);
    assert.equal("client_secret" in (cleaned as any).nested, false);
    assert.equal((cleaned as any).nested.wabaId, "123");
  });
});
