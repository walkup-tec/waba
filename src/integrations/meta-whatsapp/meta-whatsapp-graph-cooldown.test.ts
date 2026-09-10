import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearMetaGraphUploadCooldownForTests,
  isMetaGraphUploadCooldown,
  markMetaGraphUploadCooldown,
  remainingMetaGraphUploadCooldownMs,
} from "./meta-whatsapp-graph-cooldown";

describe("cooldown Graph após código 4", () => {
  it("marca e libera o bloqueio", () => {
    clearMetaGraphUploadCooldownForTests();
    assert.equal(isMetaGraphUploadCooldown(1_000), false);
    markMetaGraphUploadCooldown(1_000);
    assert.equal(isMetaGraphUploadCooldown(1_000), true);
    assert.ok(remainingMetaGraphUploadCooldownMs(1_000) > 0);
    assert.equal(isMetaGraphUploadCooldown(1_000 + 31 * 60 * 1000), false);
    clearMetaGraphUploadCooldownForTests();
  });
});
