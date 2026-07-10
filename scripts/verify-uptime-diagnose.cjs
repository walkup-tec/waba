/**
 * Valida diagnoseUptimeTarget para todos os playbooks (modo leitura, sem SSH).
 * Uso: npm run verify:uptime-diagnose
 */
const path = require("path");

const depsNodeModules = path.join(process.env.USERPROFILE || "", ".waba-h-deps", "node_modules");
process.env.NODE_PATH = depsNodeModules;
require("module").Module._initPaths();

require(path.join(__dirname, "..", "dist", "load-env"));

const { diagnoseUptimeTarget } = require("../dist/monitoring/uptime-monitor-diagnostics.service");
const { UPTIME_PLAYBOOK_TARGET_KEYS } = require("../dist/monitoring/uptime-playbooks");

async function main() {
  const started = Date.now();
  let failures = 0;

  for (const key of UPTIME_PLAYBOOK_TARGET_KEYS) {
    try {
      const result = await diagnoseUptimeTarget(key);
      const stepCount = Array.isArray(result.steps) ? result.steps.length : 0;
      const status = result.light?.ok ? "OK" : "DOWN";
      console.log(`[verify] ${key}: ${status} — ${stepCount} passo(s), hints=${result.hints?.length ?? 0}`);
      if (!result.playbook?.steps?.length) {
        console.error(`[verify] ${key}: playbook sem passos`);
        failures += 1;
      }
    } catch (error) {
      failures += 1;
      console.error(`[verify] ${key}: ERRO —`, error instanceof Error ? error.message : error);
    }
  }

  const elapsedMs = Date.now() - started;
  console.log(`[verify] concluído em ${elapsedMs}ms — falhas=${failures}`);
  if (failures) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
