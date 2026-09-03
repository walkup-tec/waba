import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMetaTemplateRouteId } from "./meta-whatsapp-template-route-id";
import { toPublicMetaError } from "./meta-whatsapp-errors";

describe("rota templateId vs ai", () => {
  it("rejeita o segmento ai que a Express capturava como :templateId", () => {
    assert.equal(isMetaTemplateRouteId("ai"), false);
    assert.equal(isMetaTemplateRouteId("sync"), false);
    assert.equal(isMetaTemplateRouteId(""), false);
  });

  it("aceita UUID de template", () => {
    assert.equal(isMetaTemplateRouteId("5552c6f7-72e5-40ea-935f-c44c685fa0b4"), true);
  });

  it("não vaza erro de uuid do Postgres para o modal", () => {
    const publicError = toPublicMetaError(new Error('invalid input syntax for type uuid: "ai"'));
    assert.equal(publicError.code, "template_not_found");
    assert.equal(publicError.error, "Template não encontrado.");
  });
});
