/**
 * Zera todas as compras de assinante (v02): pedidos, créditos, bônus, splits,
 * intakes de campanha e campanhas no Supabase.
 *
 * Mantém: assinantes, usuários master, config split, aquecedor, disparos-local-state.
 *
 * Uso: node scripts/reset-all-subscriber-purchases-v02.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.v02") });

const DATA_DIR = path.join(__dirname, "..", "data", "v02");

const EMPTY_FILES = {
  "waba-billing-orders.json": "[]",
  "waba-disparos-credit-usage.json": JSON.stringify({ version: 2, entries: [] }, null, 2),
  "waba-disparos-bonus-balances.json": JSON.stringify({ version: 2, entries: [] }, null, 2),
  "waba-financeiro-split-settlements.json": JSON.stringify({ version: 1, settlements: [] }, null, 2),
  "waba-campaign-intakes.json": JSON.stringify({ version: 1, intakes: [] }, null, 2),
};

const removeDirRecursive = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removeDirRecursive(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
};

const countBefore = () => {
  const stats = {};
  for (const fileName of Object.keys(EMPTY_FILES)) {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      stats[fileName] = 0;
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(parsed)) stats[fileName] = parsed.length;
      else if (fileName === "waba-campaign-intakes.json") stats[fileName] = parsed.intakes?.length ?? 0;
      else if (fileName === "waba-financeiro-split-settlements.json") stats[fileName] = parsed.settlements?.length ?? 0;
      else stats[fileName] = parsed.entries?.length ?? 0;
    } catch {
      stats[fileName] = -1;
    }
  }
  const intakesDir = path.join(DATA_DIR, "campaign-intakes");
  stats["campaign-intakes-dirs"] = fs.existsSync(intakesDir)
    ? fs.readdirSync(intakesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    : 0;
  return stats;
};

const resetLocal = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [fileName, content] of Object.entries(EMPTY_FILES)) {
    const filePath = path.join(DATA_DIR, fileName);
    fs.writeFileSync(filePath, content, "utf-8");
    const tmp = `${filePath}.tmp`;
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
  const intakesDir = path.join(DATA_DIR, "campaign-intakes");
  if (fs.existsSync(intakesDir)) {
    for (const entry of fs.readdirSync(intakesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) removeDirRecursive(path.join(intakesDir, entry.name));
      else fs.unlinkSync(path.join(intakesDir, entry.name));
    }
  } else {
    fs.mkdirSync(intakesDir, { recursive: true });
  }
};

const resetSupabase = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[supabase] SUPABASE_URL ou SERVICE_ROLE_KEY ausente — pulando banco.");
    return { campaigns: null, leads: null };
  }
  const supabase = createClient(url, key);
  const { count: leadsBefore } = await supabase
    .from("disparos_campaign_leads")
    .select("*", { count: "exact", head: true });
  const { count: campaignsBefore } = await supabase
    .from("disparos_campaigns")
    .select("*", { count: "exact", head: true });

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

  const { count: leadsAfter } = await supabase
    .from("disparos_campaign_leads")
    .select("*", { count: "exact", head: true });
  const { count: campaignsAfter } = await supabase
    .from("disparos_campaigns")
    .select("*", { count: "exact", head: true });

  return {
    campaigns: { before: campaignsBefore ?? 0, after: campaignsAfter ?? 0 },
    leads: { before: leadsBefore ?? 0, after: leadsAfter ?? 0 },
  };
};

(async () => {
  console.log("=== Reset compras assinante (v02) ===\n");
  const before = countBefore();
  console.log("Antes (local):", JSON.stringify(before, null, 2));

  resetLocal();
  console.log("\nArquivos locais zerados.");

  const supabase = await resetSupabase();
  console.log("\nSupabase:", JSON.stringify(supabase, null, 2));

  const after = countBefore();
  console.log("\nDepois (local):", JSON.stringify(after, null, 2));
  console.log("\nConcluído. Reinicie npm run dev:v02 se o servidor estiver rodando.");
})().catch((err) => {
  console.error("Falha:", err.message || err);
  process.exit(1);
});
