import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MetaWhatsappError,
  toPublicMetaError,
  wrapMetaHeaderUploadError,
} from "./meta-whatsapp-errors";
import { publicMetaGraphMediaUploadMessage } from "./meta-whatsapp-graph-errors";
import { resumableUploadTimeoutMs } from "./meta-whatsapp-resumable-upload";

describe("erros públicos Meta no upload de cabeçalho", () => {
  it("reconhece MetaWhatsappError mesmo sem instanceof (duck-type)", () => {
    const fake = {
      name: "MetaWhatsappError",
      code: "template_upload_failed",
      status: 400,
      message: "A Meta recusou o arquivo. Vídeo de teste.",
    };
    const publicError = toPublicMetaError(fake);
    assert.equal(publicError.code, "template_upload_failed");
    assert.match(publicError.error, /Vídeo de teste/);
  });

  it("traduz AbortError/timeout em mensagem útil de upload", () => {
    const publicError = toPublicMetaError(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
    assert.equal(publicError.code, "template_upload_failed");
    assert.match(publicError.error, /16 MB/);
  });

  it("lê cause do undici (fetch failed) em vez de unknown", () => {
    const err = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }),
    });
    const publicError = toPublicMetaError(err);
    assert.equal(publicError.code, "template_upload_failed");
    assert.match(publicError.error, /16 MB|conexão|mídia/i);
  });

  it("não devolve code unknown sem mensagem", () => {
    const publicError = toPublicMetaError({});
    assert.equal(publicError.code, "template_upload_failed");
    assert.match(publicError.error, /MP4|mídia|cabeçalho|API/i);
  });

  it("dá mais tempo de upload para vídeo do que para imagem", () => {
    assert.equal(resumableUploadTimeoutMs("image/jpeg"), 60_000);
    assert.equal(resumableUploadTimeoutMs("video/mp4"), 300_000);
    assert.equal(resumableUploadTimeoutMs("video/mp4", 10_000), 10_000);
  });

  it("mantém instanceof MetaWhatsappError", () => {
    const publicError = toPublicMetaError(new MetaWhatsappError("invalid_token"));
    assert.equal(publicError.code, "invalid_token");
  });

  it("Graph code 4 chega ao JSON público como rate limit — não como culpar tamanho", () => {
    const detailed = publicMetaGraphMediaUploadMessage(
      { error: { message: "(#4) Application request limit reached", code: 4, type: "OAuthException" } },
      { fileBytes: 14_513 },
    );
    const wrapped = wrapMetaHeaderUploadError(new Error(detailed));
    const publicError = toPublicMetaError(wrapped);
    // Sintoma do Network do usuário antes do fix (mensagem genérica de tamanho):
    assert.doesNotMatch(publicError.error, /Se for por tamanho|Se for por tamanho/i);
    assert.doesNotMatch(publicError.error, /reduza a imagem|reduza a imagem/i);
    assert.match(publicError.error, /limitou temporariamente|código 4/i);
    assert.match(publicError.error, /Aguarde alguns minutos/i);
    assert.equal(publicError.code, "template_upload_failed");
    assert.equal(publicError.ok, false);
  });

  it("fallback genérico de template_upload_failed não culpa tamanho", () => {
    const publicError = toPublicMetaError(new MetaWhatsappError("template_upload_failed"));
    assert.doesNotMatch(publicError.error, /Se for por tamanho|Se for por tamanho/i);
    assert.doesNotMatch(publicError.error, /reduza a imagem|reduza a imagem/i);
  });
});
