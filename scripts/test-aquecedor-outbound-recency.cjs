const {
  evaluateOutboundSamplePayload,
  evoRecordTimestampMs,
} = require("../dist/aquecedor/outbound-ack-health.service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const now = Date.parse("2026-08-18T17:00:00.000Z");
const oldTs = Math.floor(Date.parse("2026-08-15T23:30:55.000Z") / 1000);
const freshTs = Math.floor(Date.parse("2026-08-18T16:50:00.000Z") / 1000);

assert(evoRecordTimestampMs({ messageTimestamp: oldTs }) === oldTs * 1000, "unix seconds");

const staleBroken = evaluateOutboundSamplePayload(
  {
    messages: {
      records: Array.from({ length: 17 }, () => ({
        messageTimestamp: oldTs,
        MessageUpdate: [{ status: "ERROR" }],
      })),
    },
  },
  { nowMs: now, maxAgeMs: 12 * 60 * 60 * 1000 },
);
assert(staleBroken.class === "unknown", `stale ERROR must be unknown, got ${staleBroken.class}`);
assert(staleBroken.sampleSize === 0, `stale sampleSize 0, got ${staleBroken.sampleSize}`);

const recentBroken = evaluateOutboundSamplePayload(
  {
    messages: {
      records: Array.from({ length: 5 }, () => ({
        messageTimestamp: freshTs,
        MessageUpdate: [{ status: "ERROR" }],
      })),
    },
  },
  { nowMs: now, maxAgeMs: 12 * 60 * 60 * 1000 },
);
assert(recentBroken.class === "broken", `recent ERROR must be broken, got ${recentBroken.class}`);

const recentHealthy = evaluateOutboundSamplePayload(
  {
    messages: {
      records: [
        { messageTimestamp: freshTs, MessageUpdate: [{ status: "DELIVERY_ACK" }] },
        { messageTimestamp: freshTs, MessageUpdate: [{ status: "DELIVERY_ACK" }] },
        { messageTimestamp: freshTs, MessageUpdate: [{ status: "DELIVERY_ACK" }] },
      ],
    },
  },
  { nowMs: now, maxAgeMs: 12 * 60 * 60 * 1000 },
);
assert(recentHealthy.class === "healthy", `recent ACK must be healthy, got ${recentHealthy.class}`);

console.log("ok");
