/**
 * Smoke test local do computeInstanceWarmthLevel (sem Supabase).
 * node -r esbuild-register ... OR after build: node dist/...
 */
const {
  computeInstanceWarmthLevel,
  computeWarmthFromLifecycleRow,
} = require("../dist/services/aquecedor-instance-warmth.service.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Volume alto + idade baixa: antes zerava por teto 20-50; agora sobe.
const youngHot = computeInstanceWarmthLevel({
  phase: "active",
  activatedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  ageDays: 2,
  avgDailySends: 75,
  replyRate: 0.98,
  sends7d: 151,
  receives7d: 149,
  lifetimeSent: 151,
  lifetimeRecv: 149,
});
assert(youngHot.level >= 1, `youngHot expected >=1 got ${youngHot.level}`);

// Chip 6973-like: idade longa + volume vitalício
const chip6973 = computeWarmthFromLifecycleRow(
  { phase: "active", activatedAt: new Date().toISOString() },
  { sends7d: 587, receives7d: 593, sendsLifetime: 633, receivesLifetime: 638 },
  new Date(Date.now() - 54 * 864e5).toISOString(),
);
assert(chip6973.ageDays >= 50, `age expected ~54 got ${chip6973.ageDays}`);
assert(chip6973.level >= 2, `chip6973 expected >=2 got ${chip6973.level}`);

// Chip 82477-like com histórico digital-corban
const chip82477 = computeWarmthFromLifecycleRow(
  { phase: "active", activatedAt: new Date(Date.now() - 2 * 864e5).toISOString() },
  { sends7d: 151, receives7d: 149, sendsLifetime: 365, receivesLifetime: 361 },
  new Date(Date.now() - 46 * 864e5).toISOString(),
);
assert(chip82477.level >= 2, `chip82477 expected >=2 got ${chip82477.level}`);

console.log(
  JSON.stringify(
    {
      ok: true,
      youngHot,
      chip6973: { level: chip6973.level, ageDays: chip6973.ageDays, avg: chip6973.avgDailySends },
      chip82477: { level: chip82477.level, ageDays: chip82477.ageDays, avg: chip82477.avgDailySends },
    },
    null,
    2,
  ),
);
