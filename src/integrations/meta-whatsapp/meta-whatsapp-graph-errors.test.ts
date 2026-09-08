import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMetaGraphRateLimitCode,
  isMetaGraphRateLimitPayload,
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
});
