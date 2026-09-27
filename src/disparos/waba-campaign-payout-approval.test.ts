import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE,
  PAYOUT_EVIDENCE_REQUIRED_MESSAGE,
  PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE,
  assertPayoutEvidenceUpload,
  isAllowedPayoutEvidenceMime,
  isPendingMasterPayoutApproval,
  resolvePayoutEvidenceExtension,
} from "./waba-campaign-payout-approval";

describe("evidência de pagamento do operador", () => {
  it("aceita JPEG, PNG e WebP", () => {
    assert.equal(isAllowedPayoutEvidenceMime("image/jpeg"), true);
    assert.equal(isAllowedPayoutEvidenceMime("image/png"), true);
    assert.equal(isAllowedPayoutEvidenceMime("image/webp"), true);
    assert.equal(isAllowedPayoutEvidenceMime("application/pdf"), false);
    assert.equal(resolvePayoutEvidenceExtension("image/webp"), ".webp");
    assert.equal(resolvePayoutEvidenceExtension("image/png"), ".png");
    assert.equal(resolvePayoutEvidenceExtension("image/jpeg"), ".jpg");
  });

  it("exige o print e rejeita tipo ou tamanho inválido", () => {
    assert.throws(() => assertPayoutEvidenceUpload(null), { message: PAYOUT_EVIDENCE_REQUIRED_MESSAGE });
    assert.throws(
      () =>
        assertPayoutEvidenceUpload({
          buffer: Buffer.from("abc"),
          originalName: "a.gif",
          mimeType: "image/gif",
        }),
      { message: PAYOUT_EVIDENCE_INVALID_TYPE_MESSAGE },
    );
    assert.throws(
      () =>
        assertPayoutEvidenceUpload({
          buffer: Buffer.alloc(9 * 1024 * 1024),
          originalName: "a.png",
          mimeType: "image/png",
        }),
      { message: PAYOUT_EVIDENCE_TOO_LARGE_MESSAGE },
    );
  });

  it("reconhece aprovação pendente do master", () => {
    assert.equal(isPendingMasterPayoutApproval({ status: "pending_master" } as never), true);
    assert.equal(isPendingMasterPayoutApproval({ status: "approved" } as never), false);
    assert.equal(isPendingMasterPayoutApproval(null), false);
  });
});
