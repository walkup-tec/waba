/**
 * E2E interno — 2 jobs Leads PJ em paralelo (maxPages=2 cada).
 * Valida: métrica pagesDone = checkpoint (não CNPJ/20) + 2 scrapes simultâneos.
 *
 * Uso (Windows local headed):
 *   node scripts/e2e-leads-pj-dual.cjs
 *
 * Credenciais: CASADOSDADOS_* no .env / .env.v02 (raiz ou parent).
 * Não publica em produção / não mexe no Easypanel.
 */
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const root = path.resolve(__dirname, "..");
const parent = path.resolve(root, "..");
// Prefer D: Waba env then clone
loadEnvFile(path.join("D:", "01A-Drax-Servidor", "Waba", ".env"));
loadEnvFile(path.join("D:", "01A-Drax-Servidor", "Waba", ".env.v02"));
loadEnvFile(path.join(parent, ".env.v02"));
loadEnvFile(path.join(parent, ".env"));
loadEnvFile(path.join(root, ".env.v02"));
loadEnvFile(path.join(root, ".env"));

process.env.WABA_ENV = process.env.WABA_ENV || "v02";
process.env.CASADOSDADOS_BROWSER_SERVER = "0";
process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES = "2";
process.env.CASADOSDADOS_SCRAPE_STAGGER_MS =
  process.env.CASADOSDADOS_SCRAPE_STAGGER_MS || "3000";
process.env.CASADOSDADOS_SCRAPE_RETRIES =
  process.env.CASADOSDADOS_SCRAPE_RETRIES || "3";
process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS =
  process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS || "90000";
if (process.env.E2E_HEADLESS === "1") process.env.CASADOSDADOS_HEADLESS = "1";
else process.env.CASADOSDADOS_HEADLESS = process.env.CASADOSDADOS_HEADLESS || "0";

const {
  scrapeCasaDosDadosLeads,
  resolvePortalResumePage,
} = require("../dist/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.js");
const {
  resolveScrapeHistoryMetrics,
} = require("../dist/marketing/leads-cnpj/waba-leads-cnpj.service.js");

const logPath = path.join(root, ".tmp-e2e-leads-pj-dual.log");
const lines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  console.log(line);
}

function assertMetricsUnit() {
  const list = {
    filters: { maxPages: 1000 },
    scrapeCompleted: false,
    scrapeCheckpoint: {
      nextPage: 323,
      pagesToFetch: 1000,
      collectedCount: 1180,
      portalTotal: null,
    },
  };
  const m = resolveScrapeHistoryMetrics(list, 1180, 0);
  // Antes: pagesDone=59 (1180/20). Agora: 322 (nextPage-1).
  if (m.pagesDone !== 322) {
    throw new Error(`metrics unit fail: pagesDone=${m.pagesDone} expected 322 (volume=${m.volumePages})`);
  }
  if (m.volumePages !== 59) {
    throw new Error(`metrics unit fail: volumePages=${m.volumePages} expected 59`);
  }
  const resume = resolvePortalResumePage(323, 60);
  if (resume !== 60) {
    throw new Error(`resume unit fail: ${resume} expected 60`);
  }
  log("OK unit: pagesDone=322 (not 59); resume 323→60");
}

async function runOne(label, filters) {
  const checkpoints = [];
  const result = await scrapeCasaDosDadosLeads(
    filters,
    (msg) => log(`${label} ${msg}`),
    {
      onPageCheckpoint: async (c) => {
        checkpoints.push({
          completedPage: c.completedPage,
          nextPage: c.nextPage,
          leads: (c.pageLeads || []).length,
        });
        log(
          `${label} CKPT page=${c.completedPage} next=${c.nextPage} leads=${(c.pageLeads || []).length}`,
        );
      },
    },
  );
  return { label, result, checkpoints };
}

(async () => {
  try {
    assertMetricsUnit();
  } catch (e) {
    log("FAIL unit: " + (e && e.message ? e.message : e));
    fs.writeFileSync(logPath, lines.join("\n"), "utf8");
    process.exit(2);
  }

  if (!process.env.CASADOSDADOS_EMAIL || !process.env.CASADOSDADOS_PASSWORD) {
    log("FAIL: CASADOSDADOS_EMAIL/PASSWORD ausentes — unit OK; scrape E2E skipped");
    fs.writeFileSync(logPath, lines.join("\n"), "utf8");
    process.exit(0);
  }

  const base = {
    buscaEmRazaoSocial: true,
    buscaEmNomeFantasia: true,
    buscaEmNomeSocio: true,
    tipoPesquisa: "Exata",
    situacaoCadastral: ["Ativa"],
    incluirAtividadeSecundaria: true,
    somenteCelular: true,
    maxPages: 2,
  };
  const jobA = { ...base, atividadePrincipalCnae: "6619302" }; // Corban-like
  const jobB = { ...base, atividadePrincipalCnae: "6821801" }; // Imobiliária-like

  log(
    `START dual e2e maxPages=2 concurrent=${process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES} headed=${process.env.CASADOSDADOS_HEADLESS}`,
  );

  const started = Date.now();
  let results;
  try {
    results = await Promise.all([
      runOne("A", jobA),
      runOne("B", jobB),
    ]);
  } catch (e) {
    log("FAIL dual scrape: " + (e && e.message ? e.message : e));
    fs.writeFileSync(logPath, lines.join("\n"), "utf8");
    process.exit(1);
  }

  const elapsedSec = Math.round((Date.now() - started) / 1000);
  let ok = true;
  for (const r of results) {
    const count = (r.result.leads || []).length;
    const lastCkpt = r.checkpoints[r.checkpoints.length - 1];
    const pagesFromCkpt = lastCkpt ? lastCkpt.completedPage : 0;
    const mockList = {
      filters: { maxPages: 2 },
      scrapeCheckpoint: lastCkpt
        ? {
            nextPage: lastCkpt.nextPage,
            pagesToFetch: 2,
            collectedCount: count,
            portalTotal: null,
          }
        : null,
      scrapeCompleted: r.result.scrapeCompleted,
    };
    const metrics = resolveScrapeHistoryMetrics(mockList, count, 0);
    const rowOk =
      count > 0 &&
      r.result.scrapeCompleted === true &&
      pagesFromCkpt >= 1 &&
      metrics.pagesDone === pagesFromCkpt;
    if (!rowOk) ok = false;
    log(
      `SUMMARY ${r.label} ok=${rowOk} count=${count} completed=${r.result.scrapeCompleted} reason=${r.result.doneReason} ckptPage=${pagesFromCkpt} metricsPages=${metrics.pagesDone}`,
    );
  }

  log(`DONE dual elapsed=${elapsedSec}s ok=${ok}`);
  fs.writeFileSync(logPath, lines.join("\n"), "utf8");
  process.exit(ok ? 0 : 1);
})();
