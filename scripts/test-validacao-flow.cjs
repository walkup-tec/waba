#!/usr/bin/env node
/**
 * Testes locais: connectionState fresh, waitFor open, findChats/findMessages.
 * Uso: EVO_API_URL=... EVO_TLS_INSECURE=1 node scripts/test-validacao-flow.cjs
 */
require("dotenv").config();
const {
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
  isEvoConnectionInProgress,
  waitForEvoInstanceLiveOpen,
  invalidateEvoLiveStateCache,
} = require("../dist/instances/evo-connection-state.service.js");
const { evoHttpRequest } = require("../dist/evo-http.client.js");

const EVO_API_BASE = String(process.env.EVO_API_URL || "").replace(/\/+$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");

async function main() {
  if (!EVO_API_BASE) {
    console.error("Defina EVO_API_URL");
    process.exit(1);
  }
  console.log("EVO:", EVO_API_BASE);

  const samples = ["drax", "final-6019", "soma"];
  for (const name of samples) {
    invalidateEvoLiveStateCache(name);
    const t0 = Date.now();
    const stale = await fetchEvoInstanceLiveState(name);
    const fresh = await fetchEvoInstanceLiveState(name, { fresh: true });
    console.log(
      `[state] ${name}: stale=${stale} fresh=${fresh} open=${isEvoLiveStateOpen(fresh)} connecting=${isEvoConnectionInProgress(fresh)} (${Date.now() - t0}ms)`,
    );
  }

  let probeName = "drax";
  for (const n of samples) {
    const st = await fetchEvoInstanceLiveState(n, { fresh: true });
    if (isEvoLiveStateOpen(st)) {
      probeName = n;
      break;
    }
  }

  const fm = await evoHttpRequest(
    `${EVO_API_BASE}/chat/findMessages/${encodeURIComponent(probeName)}`,
    "POST",
    { apiKey: EVO_API_KEY, body: { limit: 3 }, timeoutMs: 15000, retries: 1 },
  );
  console.log(`[findMessages] ${probeName}: HTTP ${fm.status} ok=${fm.ok}`);

  const wait = await waitForEvoInstanceLiveOpen(probeName, { maxWaitMs: 8000, pollMs: 400 });
  console.log(`[waitForOpen] ${probeName}:`, wait);

  console.log("\nOK — connectionState + findMessages respondendo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
