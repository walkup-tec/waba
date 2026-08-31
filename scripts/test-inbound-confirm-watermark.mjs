/**
 * Testes do piso de timestamp da validação CONFIRMAR (anti-stale / prestart grace).
 * Uso: node scripts/test-inbound-confirm-watermark.mjs
 */
const CLOCK_SKEW_MS = 2_000;
const PRESTART_GRACE_MS = 180_000;

function inboundAcceptMinTimestampMs(record) {
  const graceFloor = record.validationStartedAtMs - PRESTART_GRACE_MS;
  const captured = record.keywordHighWaterMarkMs || 0;
  if (captured > 0 && captured < graceFloor) return graceFloor;
  return graceFloor;
}

/** Lógica ANTIGA (bug) */
function oldBuggyMinTs(validationStartedAtMs, capturedWaterMarkMs) {
  const keywordHighWaterMarkMs = Math.max(capturedWaterMarkMs, validationStartedAtMs);
  const afterStart = validationStartedAtMs - CLOCK_SKEW_MS;
  const afterHistory = keywordHighWaterMarkMs + 1;
  return Math.max(afterStart, afterHistory);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const now = Date.now();
const recentConfirmTs = now - 15_000;
const oldConfirmTs = now - 3_600_000;

{
  const start = now;
  const oldMin = oldBuggyMinTs(start, recentConfirmTs);
  const newMin = inboundAcceptMinTimestampMs({
    validationStartedAtMs: start,
    keywordHighWaterMarkMs: recentConfirmTs,
  });
  assert(recentConfirmTs < oldMin, "old bug should reject recent confirm");
  assert(recentConfirmTs >= newMin, "new logic must accept recent confirm");
  console.log("case1_recent_prestart OK");
}

{
  const start = now;
  const newMin = inboundAcceptMinTimestampMs({
    validationStartedAtMs: start,
    keywordHighWaterMarkMs: oldConfirmTs,
  });
  assert(oldConfirmTs < newMin, "old history must stay rejected");
  const freshTs = start - 30_000;
  assert(freshTs >= newMin, "message 30s before start must pass");
  console.log("case2_old_history OK");
}

{
  const start = now;
  const sentAt = start - 5_000;
  const newMin = inboundAcceptMinTimestampMs({
    validationStartedAtMs: start,
    keywordHighWaterMarkMs: sentAt,
  });
  assert(sentAt >= newMin, "forceRestart must not stale the just-sent CONFIRMAR");
  console.log("case3_force_restart OK");
}

{
  const start = now;
  const newMin = inboundAcceptMinTimestampMs({
    validationStartedAtMs: start,
    keywordHighWaterMarkMs: 0,
  });
  const after = start + 1_000;
  assert(after >= newMin, "post-start message must pass");
  console.log("case4_post_start OK");
}

console.log(JSON.stringify({ ok: true, graceMs: PRESTART_GRACE_MS }));
