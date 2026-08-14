#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const {
  ASAAS_EXTERNAL_REFERENCE_MAX,
  buildLegacySplitLineAsaasExternalReference,
  buildSplitLineAsaasExternalReference,
  baseSplitLineExternalReference,
  splitLineExternalReferencesMatch,
} = require("../dist/billing/asaas-identifiers.js");

const orderId = "58aa9a81-f2bc-4f32-8800-78a6bcde1212";
const participantId = "153f2fa9-1b40-4edd-9b0d-d6663da490a5";

const legacy = buildLegacySplitLineAsaasExternalReference({
  orderId,
  lineKind: "partner",
  participantId,
});
assert(legacy.length < ASAAS_EXTERNAL_REFERENCE_MAX, "legacy base under limit");

for (let attempt = 0; attempt <= 20; attempt += 1) {
  const ref = buildSplitLineAsaasExternalReference({
    orderId,
    lineKind: "partner",
    participantId,
    retryAttempt: attempt,
  });
  assert(
    ref.length <= ASAAS_EXTERNAL_REFERENCE_MAX,
    `compact ref attempt ${attempt} exceeds max: ${ref.length}`,
  );
}

const legacyRetry = `${legacy}:retry:1786715808387:retry:1786715829000`;
assert(
  legacy.length < ASAAS_EXTERNAL_REFERENCE_MAX,
  "legacy without retry suffix fits",
);
assert(
  legacyRetry.length > ASAAS_EXTERNAL_REFERENCE_MAX,
  "legacy chained retry exceeds max (bug reproduced)",
);

assert(
  splitLineExternalReferencesMatch(legacy, legacyRetry),
  "legacy base matches retried ref",
);
assert(
  splitLineExternalReferencesMatch(
    buildSplitLineAsaasExternalReference({ orderId, lineKind: "partner", participantId, retryAttempt: 2 }),
    buildSplitLineAsaasExternalReference({ orderId, lineKind: "partner", participantId, retryAttempt: 0 }),
  ),
  "compact refs same base",
);
assert(
  baseSplitLineExternalReference(legacyRetry) === legacy,
  "strip legacy retry suffix",
);

console.log("verify-split-external-reference: OK");
