import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crc16CcittFalse, isValidPixEmvPayload, normalizePixEmvPayload } from "./pix-emv";
import { formatDueDateInBrazil, isPixQrExpired, parseAsaasDateTimeToIso, stripPixQrEncodedImage } from "./asaas-pix-qr";

describe("pix-emv", () => {
  it("valida o payload de exemplo do Asaas (CRC 6304)", () => {
    const payload =
      "00020101021226730014br.gov.bcb.pix2551pix-h.asaas.com/pixqrcode/cobv/pay_76575613967995145204000053039865802BR5905ASAAS6009Joinville61088922827162070503***63045E7A";
    assert.equal(isValidPixEmvPayload(payload), true);
    assert.equal(crc16CcittFalse(payload.slice(0, payload.lastIndexOf("6304") + 4)), "5E7A");
  });

  it("rejeita payload truncado (causa típica de QR124E)", () => {
    const payload =
      "00020101021226730014br.gov.bcb.pix2551pix-h.asaas.com/pixqrcode/cobv/pay_76575613967995145204000053039865802BR5905ASAAS6009Joinville61088922827162070503***63045E7A";
    assert.equal(isValidPixEmvPayload(payload.slice(0, -2)), false);
    assert.equal(isValidPixEmvPayload(""), false);
    assert.equal(isValidPixEmvPayload("nao-e-pix"), false);
  });

  it("remove quebras de linha sem alterar o EMV", () => {
    const compact =
      "00020101021226730014br.gov.bcb.pix2551pix-h.asaas.com/pixqrcode/cobv/pay_76575613967995145204000053039865802BR5905ASAAS6009Joinville61088922827162070503***63045E7A";
    assert.equal(normalizePixEmvPayload(`${compact}\n`), compact);
  });
});

describe("asaas-pix-qr", () => {
  it("interpreta expirationDate do Asaas como horário de Brasília", () => {
    const iso = parseAsaasDateTimeToIso("2026-08-31 23:59:59");
    assert.equal(iso, "2026-09-01T02:59:59.000Z");
    assert.equal(isPixQrExpired(iso, Date.parse("2026-09-01T03:00:00.000Z")), true);
    assert.equal(isPixQrExpired(iso, Date.parse("2026-09-01T02:00:00.000Z")), false);
  });

  it("formata vencimento em calendário America/Sao_Paulo", () => {
    const due = formatDueDateInBrazil(1);
    assert.match(due, /^\d{4}-\d{2}-\d{2}$/);
    const todayBrazil = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    assert.notEqual(due, todayBrazil);
  });

  it("remove prefixo data-url da imagem do QR", () => {
    assert.equal(stripPixQrEncodedImage("data:image/png;base64,abc"), "abc");
    assert.equal(stripPixQrEncodedImage("abc"), "abc");
  });
});
