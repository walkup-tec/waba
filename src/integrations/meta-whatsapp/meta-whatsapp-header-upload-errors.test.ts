import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MetaWhatsappError, toPublicMetaError } from "./meta-whatsapp-errors";
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
    assert.match(publicError.error, /MP4|mídia/i);
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
});
