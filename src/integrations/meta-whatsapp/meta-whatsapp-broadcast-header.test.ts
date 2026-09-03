import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BROADCAST_HEADER_MISSING_FILE_ERROR,
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
    assert.match(BROADCAST_HEADER_MISSING_FILE_ERROR, /mesmo se a imagem for igual/);
    assert.equal(headerUploadFileName("video/mp4"), "header.mp4");
  });

  it("só envia cabeçalho com arquivo local; nunca weblink", () => {
    assert.equal(
      classifyBroadcastHeaderMedia({
        hasLocalPreview: false,
        httpsUrl: "https://lookaside.fbsbx.com/whatsapp/sample.png",
      }),
      "missing",
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
      "missing",
    );
    assert.equal(
      classifyBroadcastHeaderMedia({ hasLocalPreview: false, httpsUrl: null }),
      "missing",
    );
  });
});
