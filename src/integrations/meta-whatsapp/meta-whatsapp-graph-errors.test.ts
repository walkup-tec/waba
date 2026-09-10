import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMetaGraphRateLimitCode,
  isMetaGraphRateLimitPayload,
  isMetaGraphWabaWriteDenied,
  publicMetaGraphRegisterMessage,
  publicMetaGraphTemplateMessage,
} from "./meta-whatsapp-graph-errors";

describe("erros Graph de cota", () => {
  it("reconhece 80008 como rate limit da WABA", () => {
    assert.equal(isMetaGraphRateLimitCode("80008"), true);
    assert.equal(
      isMetaGraphRateLimitPayload({
        error: {
          code: 80008,
          message: "(#80008) There have been too many calls to this WhatsApp Business account.",
        },
      }),
      true,
    );
  });

  it("HTTP 400 de cota não vira recusa de template", () => {
    const message = publicMetaGraphTemplateMessage("permanent", 400, {
      error: {
        code: 80008,
        message: "(#80008) There have been too many calls to this WhatsApp Business account. Wait a bit and try again.",
      },
    });
    assert.match(message, /limitou temporariamente/i);
    assert.doesNotMatch(message, /recusou o template/i);
    assert.doesNotMatch(message, /too many calls/i);
  });

  it("Unsupported post / missing permissions vira recusa de WABA, não o inglês da Graph", () => {
    const json = {
      error: {
        message:
          "Unsupported post request. Object with ID '1744257946809067' does not exist, cannot be loaded due to missing permissions, or does not support this operation.",
        code: 100,
      },
    };
    assert.equal(isMetaGraphWabaWriteDenied(json, 400), true);
    const message = publicMetaGraphTemplateMessage("permanent", 400, json);
    assert.match(message, /não gerencia essa conta|conecte essa WABA/i);
    assert.doesNotMatch(message, /Unsupported post request/i);
  });
});

describe("erros Graph de ativação (PIN)", () => {
  it("403 de permissão cita a WABA dona do chip, não o PIN genérico", () => {
    const message = publicMetaGraphRegisterMessage({
      status: 403,
      graphCode: "10",
      json: { error: { code: 10, message: "Permission denied" } },
      phoneWabaId: "1744257946809067",
      phoneWabaName: "André - WABA02",
    });
    assert.match(message, /WABA02/);
    assert.match(message, /1744257946809067/);
    assert.doesNotMatch(message, /Confira o PIN e tente de novo/);
  });

  it("133005 aponta para o PIN do WhatsApp Manager", () => {
    const message = publicMetaGraphRegisterMessage({
      status: 400,
      graphCode: "133005",
      json: { error: { code: 133005 } },
    });
    assert.match(message, /PIN de duas etapas/);
  });

  it("133006 pede verificação por SMS antes do PIN", () => {
    const message = publicMetaGraphRegisterMessage({
      status: 400,
      graphCode: "133006",
      json: { error: { code: 133006 } },
    });
    assert.match(message, /SMS/);
  });
});
