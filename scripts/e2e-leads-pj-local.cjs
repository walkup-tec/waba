/**
 * E2E controlado — Leads PJ (Casa dos Dados), 1 página.
 * Uso: node scripts/e2e-leads-pj-local.cjs
 * Não publica em produção.
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
loadEnvFile(path.join(parent, ".env.v02"));
loadEnvFile(path.join(parent, ".env"));
loadEnvFile(path.join(root, ".env.v02"));

process.env.WABA_ENV = process.env.WABA_ENV || "v02";
// Windows local: headed (igual V02). Forçar headless só com E2E_HEADLESS=1.
if (process.env.E2E_HEADLESS === "1") process.env.CASADOSDADOS_HEADLESS = "1";
else process.env.CASADOSDADOS_HEADLESS = "0";
process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS =
  process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS || "90000";
process.env.CASADOSDADOS_CNAE_TIMEOUT_MS =
  process.env.CASADOSDADOS_CNAE_TIMEOUT_MS || "25000";
process.env.CASADOSDADOS_SCRAPE_RETRIES =
  process.env.CASADOSDADOS_SCRAPE_RETRIES || "3";

const {
  scrapeCasaDosDadosLeads,
} = require("../dist/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.js");

const logPath = path.join(parent, ".tmp-e2e-leads-pj.log");
const lines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  lines.push(line);
  console.log(line);
}

(async () => {
  if (!process.env.CASADOSDADOS_EMAIL || !process.env.CASADOSDADOS_PASSWORD) {
    log("FAIL: CASADOSDADOS_EMAIL/PASSWORD ausentes");
    process.exit(2);
  }

  const filters = {
    buscaEmRazaoSocial: true,
    buscaEmNomeFantasia: true,
    buscaEmNomeSocio: true,
    tipoPesquisa: "Exata",
    situacaoCadastral: ["Ativa"],
    atividadePrincipalCnae: "6619302",
    incluirAtividadeSecundaria: true,
    somenteCelular: true,
    maxPages: 1,
  };

  log("START e2e Corban maxPages=1 headed=" + process.env.CASADOSDADOS_HEADLESS);
  try {
    const result = await scrapeCasaDosDadosLeads(filters, (msg) => log("P " + msg));
    const count = Array.isArray(result.leads) ? result.leads.length : 0;
    const summary = {
      ok: count > 0 && result.scrapeCompleted === true,
      count,
      scrapeCompleted: result.scrapeCompleted,
      doneReason: result.doneReason,
      sample: (result.leads || []).slice(0, 2).map((l) => ({
        cnpj: l.cnpj,
        nome: String(l.nome || "").slice(0, 60),
      })),
    };
    log("RESULT " + JSON.stringify(summary));
    fs.writeFileSync(logPath, lines.join("\n"), "utf8");
    process.exit(summary.ok ? 0 : 1);
  } catch (err) {
    log("ERROR " + (err && err.stack ? err.stack : String(err)));
    fs.writeFileSync(logPath, lines.join("\n"), "utf8");
    process.exit(1);
  }
})();
