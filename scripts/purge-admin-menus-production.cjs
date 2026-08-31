/**
 * Limpa dados dos menus Admin em produção (ou data-dir informado):
 *   Dashboard (agregados), Campanhas, Financeiro (só histórico de splits),
 *   Chamados, Push (histórico).
 *
 * PRESERVA (Financeiro):
 *   - waba-financeiro-split-config.json  → Fornecedores + Rateio do lucro
 *   - waba-billing-orders.json           → pedidos / informações registradas
 *
 * PRESERVA também:
 *   - assinantes, usuários staff, cupons, push-config, créditos, aquecedor, instâncias
 *
 * Uso (produção no container / VPS):
 *   node scripts/purge-admin-menus-production.cjs --data-dir /app/data --apply
 *   node scripts/purge-admin-menus-production.cjs --data-dir /app/data --apply --with-supabase
 *
 * Dry-run (padrão, sem --apply):
 *   node scripts/purge-admin-menus-production.cjs --data-dir /app/data
 *
 * Local V02 (teste):
 *   node scripts/purge-admin-menus-production.cjs --data-dir data/v02 --apply
 */
const fs = require("node:fs");
const path = require("node:path");

function argFlag(name) {
  return process.argv.includes(name);
}

function argValue(flag, fallback = "") {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || "").trim() || fallback;
}

const APPLY = argFlag("--apply");
const WITH_SUPABASE = argFlag("--with-supabase");
const DATA_DIR = path.resolve(argValue("--data-dir", path.join(__dirname, "..", "data")));

/** Arquivos esvaziados (conteúdo canônico). */
const EMPTY_FILES = {
  // Campanhas (wizard / operacional)
  "waba-campaign-intakes.json": JSON.stringify({ version: 1, intakes: [] }, null, 2) + "\n",
  // Financeiro — só histórico de liquidações/splits (NÃO toca split-config nem orders)
  "waba-financeiro-split-settlements.json":
    JSON.stringify({ version: 1, settlements: [] }, null, 2) + "\n",
  // Chamados
  "waba-support-tickets.json": JSON.stringify({ version: 1, tickets: [] }, null, 2) + "\n",
  // Push — histórico de envios (mantém waba-push-config.json)
  "waba-push-messages.json": JSON.stringify({ version: 1, messages: [] }, null, 2) + "\n",
  // Dashboard — badges / “visto” por master
  "waba-master-menu-seen.json": JSON.stringify({ version: 1, masters: {} }, null, 2) + "\n",
  // Fila local de campanhas (disparador)
  "disparos-local-state.json":
    JSON.stringify(
      { version: 1, savedAt: new Date().toISOString(), campaigns: [], leads: [] },
      null,
      2,
    ) + "\n",
};

/** Pastas de anexos a limpar (conteúdo, não o diretório raiz). */
const WIPE_DIRS = ["campaign-intakes", "support-tickets", "push-media"];

/** Nunca tocar. */
const KEEP_FILES = [
  "waba-financeiro-split-config.json",
  "waba-billing-orders.json",
  "waba-subscribers.json",
  "waba-system-users.json",
  "waba-coupons.json",
  "waba-push-config.json",
  "waba-disparos-credit-usage.json",
  "waba-disparos-bonus-balances.json",
];

function readCount(filePath, fileName) {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed.length;
    if (fileName === "waba-campaign-intakes.json") return parsed.intakes?.length ?? 0;
    if (fileName === "waba-financeiro-split-settlements.json") return parsed.settlements?.length ?? 0;
    if (fileName === "waba-support-tickets.json") return parsed.tickets?.length ?? 0;
    if (fileName === "waba-push-messages.json") return parsed.messages?.length ?? 0;
    if (fileName === "disparos-local-state.json") {
      if (Array.isArray(parsed.campaigns)) return parsed.campaigns.length;
      if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    }
    return -1;
  } catch {
    return -1;
  }
}

function countDirEntries(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  return fs.readdirSync(dirPath).length;
}

function removeDirContents(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return;
  }
  for (const name of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, name);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function backupFile(filePath, backupRoot) {
  if (!fs.existsSync(filePath)) return null;
  const rel = path.basename(filePath);
  const dest = path.join(backupRoot, rel);
  fs.copyFileSync(filePath, dest);
  return dest;
}

async function purgeSupabase() {
  const dotenvPath = path.join(__dirname, "..", ".env");
  try {
    require("dotenv").config({ path: dotenvPath });
  } catch {
    /* optional */
  }
  const url = String(process.env.SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.warn("[supabase] SUPABASE_* ausente — pulando.");
    return null;
  }
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const countTable = async (table) => {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };

  const before = {
    campaigns: await countTable("disparos_campaigns"),
    leads: await countTable("disparos_campaign_leads"),
  };

  if (!APPLY) {
    return { dryRun: true, before };
  }

  const { error: leadsError } = await supabase
    .from("disparos_campaign_leads")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (leadsError) throw new Error(`disparos_campaign_leads: ${leadsError.message}`);

  const { error: campaignsError } = await supabase
    .from("disparos_campaigns")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (campaignsError) throw new Error(`disparos_campaigns: ${campaignsError.message}`);

  return {
    dryRun: false,
    before,
    after: {
      campaigns: await countTable("disparos_campaigns"),
      leads: await countTable("disparos_campaign_leads"),
    },
  };
}

(async () => {
  console.log("=== Purge menus Admin (Dashboard / Campanhas / Financeiro parcial / Chamados / Push) ===\n");
  console.log(`data-dir: ${DATA_DIR}`);
  console.log(`mode: ${APPLY ? "APPLY (grava)" : "DRY-RUN (só lista)"}`);
  console.log(`supabase: ${WITH_SUPABASE ? "sim" : "não"}\n`);

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`[erro] Diretório não encontrado: ${DATA_DIR}`);
    process.exit(1);
  }

  console.log("PRESERVAR:");
  for (const name of KEEP_FILES) {
    const p = path.join(DATA_DIR, name);
    const exists = fs.existsSync(p);
    console.log(`  ✓ ${name}${exists ? "" : " (ausente)"}`);
  }
  console.log("");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupRoot = path.join(DATA_DIR, "_backups", `purge-admin-menus-${stamp}`);

  if (APPLY) {
    fs.mkdirSync(backupRoot, { recursive: true });
    console.log(`backup → ${backupRoot}\n`);
  }

  console.log("LIMPAR arquivos:");
  for (const [fileName, content] of Object.entries(EMPTY_FILES)) {
    const filePath = path.join(DATA_DIR, fileName);
    const before = readCount(filePath, fileName);
    console.log(`  - ${fileName}: ${before} registro(s)`);
    if (APPLY) {
      backupFile(filePath, backupRoot);
      fs.writeFileSync(filePath, content, "utf8");
      const tmp = `${filePath}.tmp`;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }

  console.log("\nLIMPAR pastas:");
  for (const dirName of WIPE_DIRS) {
    const dirPath = path.join(DATA_DIR, dirName);
    const before = countDirEntries(dirPath);
    console.log(`  - ${dirName}/: ${before} item(ns)`);
    if (APPLY) {
      if (fs.existsSync(dirPath)) {
        const dest = path.join(backupRoot, dirName);
        fs.cpSync(dirPath, dest, { recursive: true });
      }
      removeDirContents(dirPath);
    }
  }

  if (WITH_SUPABASE) {
    console.log("\nSupabase (campanhas/leads):");
    try {
      const result = await purgeSupabase();
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("[supabase] falha:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  console.log(
    APPLY
      ? "\n[ok] Purge aplicado. Reinicie o serviço se necessário e valide os menus Admin."
      : "\n[dry-run] Nada foi alterado. Rode de novo com --apply para gravar.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
