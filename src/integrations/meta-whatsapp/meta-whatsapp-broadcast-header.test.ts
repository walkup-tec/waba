import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BROADCAST_HEADER_WEBLINK_ERROR,
  classifyBroadcastHeaderMedia,
  headerUploadFileName,
  isMetaHeaderExampleUrl,
} from "./meta-whatsapp-broadcast-header";

describe("cabeçalho do Disparo Cloud", () => {
  it("reconhece URL de exemplo da Graph que não pode ir como weblink", () => {
    assert.equal(
      isMetaHeaderExampleUrl("https://lookaside.fbsbx.com/whatsapp/sample.png"),
      true,
    );
    assert.equal(isMetaHeaderExampleUrl("https://scontent.xx.fbcdn.net/v/t1.jpg"), true);
    assert.equal(isMetaHeaderExampleUrl("4::abc-handle-local"), false);
    assert.equal(isMetaHeaderExampleUrl("https://waba.draxsistemas.com.br/x.png"), false);
  });

  it("mantém o aviso de 403 no texto de falha do cabeçalho", () => {
    assert.match(BROADCAST_HEADER_WEBLINK_ERROR, /403/);
    assert.equal(headerUploadFileName("video/mp4"), "header.mp4");
  });

  it("nunca classifica URL de exemplo da Graph como weblink de envio", () => {
    assert.equal(
      classifyBroadcastHeaderMedia({
        hasLocalPreview: false,
        httpsUrl: "https://lookaside.fbsbx.com/whatsapp/sample.png",
      }),
      "refuse-weblink",
    );
    assert.equal(
      classifyBroadcastHeaderMedia({
        hasLocalPreview: true,
        httpsUrl: "https://lookaside.fbsbx.com/whatsapp/sample.png",
      }),
      "upload",
    );
    assert.equal(
      classifyBroadcastHeaderMedia({
        hasLocalPreview: false,
        httpsUrl: "https://cdn.cliente.example/capa.jpg",
      }),
      "weblink",
    );
    assert.equal(
      classifyBroadcastHeaderMedia({ hasLocalPreview: false, httpsUrl: null }),
      "missing",
    );
  });
});
