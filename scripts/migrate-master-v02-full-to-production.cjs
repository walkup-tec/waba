/**
 * Migração completa do usuário MASTER V02 → produção (/app/data).
 * Escopo: apenas o e-mail master informado — não altera assinantes (ex.: mozart).
 *
 * Exportar no PC (data V02):
 *   set WABA_V02_DATA_DIR=D:\Waba\data\v02
 *   node scripts/migrate-master-v02-full-to-production.cjs walkup@walkuptec.com.br --export-dir C:\Temp\walkup-master-v02
 *
 * Aplicar no container produção:
 *   node scripts/migrate-master-v02-full-to-production.cjs walkup@walkuptec.com.br --import-dir /tmp/walkup-master-v02 --apply-data-dir /app/data
 *
 * Aplicar remoto (após deploy com POST /admin/master/promote-from-v02):
 *   node scripts/migrate-master-v02-full-to-production.cjs walkup@walkuptec.com.br --remote https://waba.draxsistemas.com.br
 */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const emailArg = String(process.argv[2] || "walkup@walkuptec.com.br").trim().toLowerCase();
const args = process.argv.slice(3);

const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx < 0) return "";
  return String(args[idx + 1] || "").trim();
};

const exportDir = getArg("--export-dir");
const importDir = getArg("--import-dir");
const applyDataDir = getArg("--apply-data-dir");
const remoteBase = getArg("--remote");
const printBundle = args.includes("--print-bundle");

if (!emailArg.includes("@")) {
  console.error(
    "Uso: node scripts/migrate-master-v02-full-to-production.cjs [master@email] [--export-dir DIR] [--import-dir DIR --apply-data-dir /app/data] [--remote URL] [--print-bundle]",
  );
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const V02_DIR = process.env.WABA_V02_DATA_DIR
  ? path.resolve(process.env.WABA_V02_DATA_DIR)
  : path.join(ROOT, "data", "v02");

dotenv.config({ path: path.join(ROOT, ".env.v02") });
dotenv.config({ path: path.join(ROOT, ".env") });

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const readJson = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
};

const copyFileSafe = (src, dest) => {
  if (!src || !fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
};

const pathFields = ["imageStoredPath", "spreadsheetStoredPath", "spreadsheetTrimmedPath"];

function rewriteIntakePathsForDataDir(intake, dataDir) {
  const id = String(intake?.id || "").trim();
  if (!id) return intake;
  const storageDir = path.join(dataDir, "campaign-intakes", id);
  const next = { ...intake };
  for (const field of pathFields) {
    const baseName = path.basename(String(next[field] || ""));
    if (!baseName) continue;
    next[field] = path.join(storageDir, baseName);
  }
  return next;
}

function collectCampaignIntakeAssets(v02Dir, email) {
  const store = readJson(path.join(v02Dir, "waba-campaign-intakes.json"), { version: 1, intakes: [] });
  const intakes = (store.intakes || []).filter((row) => normalizeEmail(row?.ownerEmail) === email);
  const assets = [];
  for (const intake of intakes) {
    const id = String(intake?.id || "").trim();
    if (!id) continue;
    const srcDir = path.join(v02Dir, "campaign-intakes", id);
    if (!fs.existsSync(srcDir)) continue;
    for (const name of fs.readdirSync(srcDir)) {
      const src = path.join(srcDir, name);
      if (!fs.statSync(src).isFile()) continue;
      assets.push({ intakeId: id, fileName: name, sourcePath: src });
    }
  }
  return { intakes, assets };
}

function buildMasterBundle(email, v02Dir) {
  const usersStore = readJson(path.join(v02Dir, "waba-system-users.json"), { version: 1, users: [] });
  const users = Array.isArray(usersStore.users) ? usersStore.users : usersStore;
  const systemUser = (Array.isArray(users) ? users : []).find(
    (row) => normalizeEmail(row?.email) === email,
  );
  if (!systemUser || String(systemUser.role || "").toLowerCase() !== "master") {
    throw new Error(`Master não encontrado no V02: ${email}`);
  }

  const billingOrders = readJson(path.join(v02Dir, "waba-billing-orders.json"), []).filter(
    (row) => normalizeEmail(row?.ownerEmail) === email,
  );

  const usageStore = readJson(path.join(v02Dir, "waba-disparos-credit-usage.json"), {
    version: 2,
    entries: [],
  });
  const creditUsage =
    (usageStore.entries || []).find((row) => normalizeEmail(row?.email) === email) || null;

  const bonusStore = readJson(path.join(v02Dir, "waba-disparos-bonus-balances.json"), {
    version: 2,
    entries: [],
  });
  const bonusBalance =
    (bonusStore.entries || []).find((row) => normalizeEmail(row?.email) === email) || null;

  const ownersStore = readJson(path.join(v02Dir, "instance-owners.json"), { instances: {} });
  const instanceOwners = {};
  for (const [name, meta] of Object.entries(ownersStore.instances || {})) {
    if (normalizeEmail(meta?.ownerEmail) !== email) continue;
    instanceOwners[name] = {
      ownerEmail: email,
      createdAt: meta?.createdAt,
      syncedFromWalkupProdAt: meta?.syncedFromWalkupProdAt,
    };
  }

  const activationsStore = readJson(path.join(v02Dir, "alternativa-number-activations.json"), {
    byEmail: {},
  });
  const alternativaActivations = activationsStore.byEmail?.[email] || null;

  const dispatchState = readJson(path.join(v02Dir, "disparos-local-state.json"), {
    version: 1,
    campaigns: [],
  });
  const campaigns = (dispatchState.campaigns || []).filter(
    (row) => normalizeEmail(row?.ownerEmail) === email,
  );

  const intakePack = collectCampaignIntakeAssets(v02Dir, email);

  const enviosStore = readJson(path.join(v02Dir, "aquecedor-envios-log.json"), { items: [] });
  const enviosRaw = Array.isArray(enviosStore) ? enviosStore : enviosStore.items || [];
  const aquecedorEnviosLog = enviosRaw.filter((row) => normalizeEmail(row?.ownerEmail) === email);

  const lifecycle = readJson(path.join(v02Dir, "aquecedor-instance-lifecycle.json"), null);
  const lifecycleRows = lifecycle?.instances
    ? Object.fromEntries(
        Object.entries(lifecycle.instances).filter(([name]) => name in instanceOwners),
      )
    : null;

  const financeiroSplitConfig = readJson(
    path.join(v02Dir, "waba-financeiro-split-config.json"),
    null,
  );
  const settlementsStore = readJson(path.join(v02Dir, "waba-financeiro-split-settlements.json"), {
    version: 1,
    settlements: [],
  });
  const financeiroSettlements = Array.isArray(settlementsStore.settlements)
    ? settlementsStore.settlements
    : [];

  const menuSeenStore = readJson(path.join(v02Dir, "waba-master-menu-seen.json"), {
    version: 1,
    masters: {},
  });
  const masterMenuSeen = menuSeenStore.masters?.[email] || null;

  const aquecedorConfigPath = path.join(v02Dir, "aquecedor-config.json");
  const aquecedorConfig = fs.existsSync(aquecedorConfigPath)
    ? readJson(aquecedorConfigPath, null)
    : null;

  return {
    version: 2,
    kind: "master",
    email,
    exportedAt: new Date().toISOString(),
    v02Dir,
    systemUser,
    financeiroSplitConfig,
    financeiroSettlements,
    masterMenuSeen,
    aquecedorConfig,
    billingOrders,
    creditUsage,
    bonusBalance,
    instanceOwners,
    alternativaActivations,
    campaigns,
    campaignIntakes: intakePack.intakes,
    campaignIntakeAssets: intakePack.assets.map(({ intakeId, fileName, sourcePath }) => ({
      intakeId,
      fileName,
      sourcePath,
    })),
    aquecedorEnviosLog,
    aquecedorLifecycleInstances: lifecycleRows,
  };
}

function mergeById(list, incoming, idKey = "id") {
  const out = Array.isArray(list) ? [...list] : [];
  const index = new Map(
    out.map((row, i) => [String(row?.[idKey] || "").trim(), i]).filter(([id]) => id),
  );
  for (const row of incoming || []) {
    const id = String(row?.[idKey] || "").trim();
    if (!id) continue;
    if (index.has(id)) out[index.get(id)] = { ...out[index.get(id)], ...row };
    else {
      index.set(id, out.length);
      out.push(row);
    }
  }
  return out;
}

function applyMasterBundle(bundle, dataDir, importRoot = "") {
  const email = normalizeEmail(bundle.email);
  if (String(bundle.systemUser?.role || "").toLowerCase() !== "master") {
    throw new Error("Bundle inválido: systemUser não é master.");
  }

  const summary = {
    ok: true,
    kind: "master",
    email,
    dataDir,
    systemUser: "updated",
    financeiroSplitConfig: false,
    financeiroSettlementsMerged: 0,
    masterMenuSeen: false,
    aquecedorConfig: false,
    billingOrdersAdded: 0,
    creditUsage: false,
    bonusBalance: false,
    instanceOwners: 0,
    alternativaActivations: false,
    campaignsMerged: 0,
    campaignIntakesMerged: 0,
    campaignFilesCopied: 0,
    aquecedorEnviosLogMerged: 0,
    aquecedorLifecycleInstances: 0,
  };

  const usersPath = path.join(dataDir, "waba-system-users.json");
  const usersStore = readJson(usersPath, { version: 1, users: [] });
  if (!Array.isArray(usersStore.users)) usersStore.users = [];
  const userPayload = {
    ...bundle.systemUser,
    email,
    role: "master",
    updatedAt: new Date().toISOString(),
  };
  const userIdx = usersStore.users.findIndex((row) => normalizeEmail(row?.email) === email);
  if (userIdx >= 0) {
    usersStore.users[userIdx] = {
      ...usersStore.users[userIdx],
      ...userPayload,
      id: usersStore.users[userIdx].id,
    };
    summary.systemUser = "updated";
  } else {
    usersStore.users.push(userPayload);
    summary.systemUser = "created";
  }
  writeJsonAtomic(usersPath, usersStore);

  if (bundle.financeiroSplitConfig) {
    writeJsonAtomic(
      path.join(dataDir, "waba-financeiro-split-config.json"),
      bundle.financeiroSplitConfig,
    );
    summary.financeiroSplitConfig = true;
  }

  if (Array.isArray(bundle.financeiroSettlements) && bundle.financeiroSettlements.length) {
    const settlementsPath = path.join(dataDir, "waba-financeiro-split-settlements.json");
    const settlementsStore = readJson(settlementsPath, { version: 1, settlements: [] });
    if (!Array.isArray(settlementsStore.settlements)) settlementsStore.settlements = [];
    settlementsStore.settlements = mergeById(
      settlementsStore.settlements,
      bundle.financeiroSettlements,
    );
    writeJsonAtomic(settlementsPath, settlementsStore);
    summary.financeiroSettlementsMerged = bundle.financeiroSettlements.length;
  }

  if (bundle.masterMenuSeen) {
    const seenPath = path.join(dataDir, "waba-master-menu-seen.json");
    const seenStore = readJson(seenPath, { version: 1, masters: {} });
    if (!seenStore.masters || typeof seenStore.masters !== "object") seenStore.masters = {};
    seenStore.masters[email] = { ...(seenStore.masters[email] || {}), ...bundle.masterMenuSeen };
    writeJsonAtomic(seenPath, seenStore);
    summary.masterMenuSeen = true;
  }

  if (bundle.aquecedorConfig) {
    writeJsonAtomic(path.join(dataDir, "aquecedor-config.json"), bundle.aquecedorConfig);
    summary.aquecedorConfig = true;
  }

  const ordersPath = path.join(dataDir, "waba-billing-orders.json");
  const orders = readJson(ordersPath, []);
  const orderList = Array.isArray(orders) ? orders : [];
  const knownOrderIds = new Set(orderList.map((row) => String(row?.id || "").trim()).filter(Boolean));
  for (const order of bundle.billingOrders || []) {
    if (normalizeEmail(order?.ownerEmail) !== email) continue;
    const id = String(order?.id || "").trim();
    if (!id || knownOrderIds.has(id)) continue;
    orderList.unshift(order);
    knownOrderIds.add(id);
    summary.billingOrdersAdded += 1;
  }
  writeJsonAtomic(ordersPath, orderList);

  if (bundle.creditUsage) {
    const usagePath = path.join(dataDir, "waba-disparos-credit-usage.json");
    const usageStore = readJson(usagePath, { version: 2, entries: [] });
    if (!Array.isArray(usageStore.entries)) usageStore.entries = [];
    const entry = { ...bundle.creditUsage, email };
    const usageIdx = usageStore.entries.findIndex((row) => normalizeEmail(row?.email) === email);
    if (usageIdx >= 0) usageStore.entries[usageIdx] = entry;
    else usageStore.entries.push(entry);
    writeJsonAtomic(usagePath, usageStore);
    summary.creditUsage = true;
  }

  if (bundle.bonusBalance) {
    const bonusPath = path.join(dataDir, "waba-disparos-bonus-balances.json");
    const bonusStore = readJson(bonusPath, { version: 2, entries: [] });
    if (!Array.isArray(bonusStore.entries)) bonusStore.entries = [];
    const entry = { ...bundle.bonusBalance, email };
    const bonusIdx = bonusStore.entries.findIndex((row) => normalizeEmail(row?.email) === email);
    if (bonusIdx >= 0) bonusStore.entries[bonusIdx] = entry;
    else bonusStore.entries.push(entry);
    writeJsonAtomic(bonusPath, bonusStore);
    summary.bonusBalance = true;
  }

  const ownersPath = path.join(dataDir, "instance-owners.json");
  const ownersStore = readJson(ownersPath, { instances: {} });
  if (!ownersStore.instances || typeof ownersStore.instances !== "object") ownersStore.instances = {};
  const now = new Date().toISOString();
  for (const [name, meta] of Object.entries(bundle.instanceOwners || {})) {
    const key = String(name || "").trim();
    if (!key || normalizeEmail(meta?.ownerEmail) !== email) continue;
    const existingOwner = normalizeEmail(String(ownersStore.instances[key]?.ownerEmail || ""));
    if (existingOwner && existingOwner !== email) continue;
    ownersStore.instances[key] = {
      ownerEmail: email,
      createdAt: String(meta?.createdAt || now),
      ...(meta?.syncedFromWalkupProdAt
        ? { syncedFromWalkupProdAt: String(meta.syncedFromWalkupProdAt) }
        : { promotedFromV02At: now }),
    };
    summary.instanceOwners += 1;
  }
  writeJsonAtomic(ownersPath, ownersStore);

  if (bundle.alternativaActivations) {
    const actPath = path.join(dataDir, "alternativa-number-activations.json");
    const actStore = readJson(actPath, { byEmail: {} });
    if (!actStore.byEmail || typeof actStore.byEmail !== "object") actStore.byEmail = {};
    actStore.byEmail[email] = bundle.alternativaActivations;
    writeJsonAtomic(actPath, actStore);
    summary.alternativaActivations = true;
  }

  const dispatchPath = path.join(dataDir, "disparos-local-state.json");
  const dispatchStore = readJson(dispatchPath, { version: 1, campaigns: [] });
  if (!Array.isArray(dispatchStore.campaigns)) dispatchStore.campaigns = [];
  const masterCampaigns = (bundle.campaigns || []).filter(
    (row) => normalizeEmail(row?.ownerEmail) === email,
  );
  dispatchStore.campaigns = mergeById(dispatchStore.campaigns, masterCampaigns);
  dispatchStore.savedAt = new Date().toISOString();
  summary.campaignsMerged = masterCampaigns.length;
  writeJsonAtomic(dispatchPath, dispatchStore);

  const intakesPath = path.join(dataDir, "waba-campaign-intakes.json");
  const intakesStore = readJson(intakesPath, { version: 1, intakes: [] });
  if (!Array.isArray(intakesStore.intakes)) intakesStore.intakes = [];
  const intakesToApply = (bundle.campaignIntakes || [])
    .filter((row) => normalizeEmail(row?.ownerEmail) === email)
    .map((row) => rewriteIntakePathsForDataDir(row, dataDir));
  intakesStore.intakes = mergeById(intakesStore.intakes, intakesToApply);
  summary.campaignIntakesMerged = intakesToApply.length;
  writeJsonAtomic(intakesPath, intakesStore);

  for (const asset of bundle.campaignIntakeAssets || []) {
    const intakeId = String(asset?.intakeId || "").trim();
    const fileName = String(asset?.fileName || "").trim();
    if (!intakeId || !fileName) continue;
    const candidates = [
      String(asset?.sourcePath || ""),
      importRoot ? path.join(importRoot, "campaign-intakes", intakeId, fileName) : "",
    ].filter(Boolean);
    const src = candidates.find((p) => fs.existsSync(p));
    if (!src) continue;
    const dest = path.join(dataDir, "campaign-intakes", intakeId, fileName);
    if (copyFileSafe(src, dest)) summary.campaignFilesCopied += 1;
  }

  if ((bundle.aquecedorEnviosLog || []).length) {
    const logPath = path.join(dataDir, "aquecedor-envios-log.json");
    const logStore = readJson(logPath, { items: [] });
    const logList = Array.isArray(logStore) ? logStore : logStore.items || [];
    const masterLog = (bundle.aquecedorEnviosLog || []).filter(
      (row) => normalizeEmail(row?.ownerEmail) === email,
    );
    writeJsonAtomic(logPath, { items: mergeById(logList, masterLog) });
    summary.aquecedorEnviosLogMerged = masterLog.length;
  }

  if (bundle.aquecedorLifecycleInstances && Object.keys(bundle.aquecedorLifecycleInstances).length) {
    const lifePath = path.join(dataDir, "aquecedor-instance-lifecycle.json");
    const lifeStore = readJson(lifePath, { version: 1, instances: {} });
    if (!lifeStore.instances || typeof lifeStore.instances !== "object") lifeStore.instances = {};
    for (const [name, row] of Object.entries(bundle.aquecedorLifecycleInstances)) {
      if (!(name in (bundle.instanceOwners || {}))) continue;
      lifeStore.instances[name] = row;
      summary.aquecedorLifecycleInstances += 1;
    }
    writeJsonAtomic(lifePath, lifeStore);
  }

  return summary;
}

function exportBundle(bundle, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const assets = bundle.campaignIntakeAssets || [];
  const bundleForDisk = { ...bundle, campaignIntakeAssets: [] };
  for (const asset of assets) {
    const intakeId = String(asset.intakeId || "").trim();
    const fileName = String(asset.fileName || "").trim();
    const src = String(asset.sourcePath || "");
    if (!intakeId || !fileName || !src || !fs.existsSync(src)) continue;
    const dest = path.join(outDir, "campaign-intakes", intakeId, fileName);
    copyFileSafe(src, dest);
    bundleForDisk.campaignIntakeAssets.push({ intakeId, fileName, sourcePath: dest });
  }
  writeJsonAtomic(path.join(outDir, "bundle.json"), bundleForDisk);
  return {
    ok: true,
    exportDir: outDir,
    bundlePath: path.join(outDir, "bundle.json"),
    campaignFiles: bundleForDisk.campaignIntakeAssets.length,
  };
}

async function loginMaster(baseUrl) {
  const email = String(process.env.WABA_ADMIN_EMAIL || emailArg).trim();
  const password = String(process.env.WABA_ADMIN_PASSWORD || "").trim();
  if (!email || !password) {
    throw new Error("Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD em .env.v02 ou .env");
  }
  const loginRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login master falhou (${loginRes.status}): ${text.slice(0, 200)}`);
  }
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("Login master sem cookie de sessão.");
  return cookie;
}

async function promoteRemote(bundle, baseUrl) {
  const cookie = await loginMaster(baseUrl);
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/admin/master/promote-from-v02`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(bundle),
  });
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    throw new Error(`Promote master remoto falhou (${res.status}): ${payload?.error || text.slice(0, 300)}`);
  }
  return payload;
}

async function main() {
  if (!fs.existsSync(V02_DIR) && !importDir) {
    throw new Error(`Diretório V02 não encontrado: ${V02_DIR}. Defina WABA_V02_DATA_DIR.`);
  }

  if (exportDir) {
    const bundle = buildMasterBundle(emailArg, V02_DIR);
    const result = exportBundle(bundle, path.resolve(exportDir));
    console.log(JSON.stringify({ ...result, bundleSummary: summarizeBundle(bundle) }, null, 2));
    return;
  }

  if (printBundle) {
    const bundle = buildMasterBundle(emailArg, V02_DIR);
    console.log(JSON.stringify(summarizeBundle(bundle), null, 2));
    return;
  }

  if (importDir && applyDataDir) {
    const bundlePath = path.join(path.resolve(importDir), "bundle.json");
    const bundle = readJson(bundlePath, null);
    if (!bundle?.email || bundle.kind !== "master") {
      throw new Error(`bundle.json inválido em ${bundlePath}`);
    }
    const result = applyMasterBundle(bundle, path.resolve(applyDataDir), path.resolve(importDir));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (remoteBase) {
    const bundle = buildMasterBundle(emailArg, V02_DIR);
    const result = await promoteRemote(bundle, remoteBase);
    console.log(
      JSON.stringify(
        { ok: true, mode: "remote", baseUrl: remoteBase, bundleSummary: summarizeBundle(bundle), result },
        null,
        2,
      ),
    );
    return;
  }

  console.error(
    "Informe --export-dir (PC), --import-dir + --apply-data-dir (servidor) ou --remote URL (produção).",
  );
  process.exit(1);
}

function summarizeBundle(bundle) {
  return {
    email: bundle.email,
    kind: bundle.kind,
    menuPermissions: bundle.systemUser?.menuPermissions,
    billingOrders: (bundle.billingOrders || []).length,
    instanceOwners: Object.keys(bundle.instanceOwners || {}).length,
    campaignIntakes: (bundle.campaignIntakes || []).length,
    aquecedorEnviosLog: (bundle.aquecedorEnviosLog || []).length,
    financeiroSettlements: (bundle.financeiroSettlements || []).length,
    hasFinanceiroSplitConfig: Boolean(bundle.financeiroSplitConfig),
    hasAquecedorConfig: Boolean(bundle.aquecedorConfig),
  };
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
