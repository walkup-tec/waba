/**
 * Força instância para fase "active" no aquecedor (produção/ops).
 * Grava manualActiveOverride no JSON — requer dist com fix de reconcile (2026-06-24+).
 *
 * Uso no container:
 *   node scripts/force-aquecedor-instance-active.cjs 5182006011 --data-dir /app/data
 *   node scripts/force-aquecedor-instance-active.cjs 5182006011 --data-dir /app/data --owner mozart.pmo@gmail.com
 */
const fs = require("node:fs");
const path = require("node:path");

const instanceArg = String(process.argv[2] || "").trim();
const dataDir = (() => {
  const idx = process.argv.indexOf("--data-dir");
  if (idx < 0) return path.join(__dirname, "..", "data");
  return path.resolve(String(process.argv[idx + 1] || "").trim() || path.join(__dirname, "..", "data"));
})();
const ownerEmail = (() => {
  const idx = process.argv.indexOf("--owner");
  if (idx < 0) return "";
  return String(process.argv[idx + 1] || "").trim().toLowerCase();
})();

if (!instanceArg) {
  console.error(
    "Uso: node scripts/force-aquecedor-instance-active.cjs INSTANCE_NAME [--data-dir /app/data] [--owner email@dominio.com]",
  );
  process.exit(1);
}

const key = instanceArg.toLowerCase();
const now = new Date().toISOString();

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
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
};

const lifePath = path.join(dataDir, "aquecedor-instance-lifecycle.json");
let life = readJson(lifePath, {
  version: 1,
  updatedAt: now,
  lastStaggerPromotionAt: null,
  instances: {},
});
if (!life.instances || typeof life.instances !== "object") life.instances = {};

life.instances[key] = {
  phase: "active",
  preparingSince: null,
  activatedAt: now,
  restrictedUntil: null,
  restrictedReason: null,
  dailyDate: null,
  dailySendCount: 0,
  dailyCap: null,
  manualActiveOverride: true,
};
life.updatedAt = now;
writeJsonAtomic(lifePath, life);

let ownerUpdated = false;
if (ownerEmail.includes("@")) {
  const ownersPath = path.join(dataDir, "instance-owners.json");
  const owners = readJson(ownersPath, { instances: {} });
  if (!owners.instances || typeof owners.instances !== "object") owners.instances = {};
  owners.instances[instanceArg] = {
    ownerEmail,
    createdAt: now,
    manualActiveOverrideAt: now,
  };
  writeJsonAtomic(ownersPath, owners);
  ownerUpdated = true;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      instance: instanceArg,
      lifecycleKey: key,
      dataDir,
      phase: "active",
      manualActiveOverride: true,
      ownerUpdated,
      ownerEmail: ownerUpdated ? ownerEmail : null,
    },
    null,
    2,
  ),
);
