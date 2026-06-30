/**
 * Remove instância do assinante em produção (via docker exec no container).
 *
 * Uso (SSH):
 *   docker cp scripts/remove-instance-from-subscriber-docker.cjs $CID:/tmp/
 *   docker exec $CID node /tmp/remove-instance-from-subscriber-docker.cjs \
 *     --phone 5182006011 --email mozart.pmo@gmail.com --data-dir /app/data
 *
 * Opções:
 *   --phone / --instance   identificador
 *   --email                dono esperado (opcional; só avisa se divergir)
 *   --data-dir             default /app/data
 *   --dry-run              não grava
 */
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const readArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? String(args[idx + 1] || "").trim() : "";
};

const phone = readArg("--phone");
const instanceArg = readArg("--instance");
const email = readArg("--email").toLowerCase();
const dataDir = readArg("--data-dir") || "/app/data";
const dryRun = args.includes("--dry-run");

const ownersPath = path.join(dataDir, "instance-owners.json");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function findOwnerKeys(store, query) {
  const q = digits(query);
  const hits = [];
  for (const key of Object.keys(store.instances || {})) {
    const keyDigits = digits(key);
    if (!q) {
      if (key.toLowerCase() === String(query || "").trim().toLowerCase()) hits.push(key);
      continue;
    }
    if (
      keyDigits &&
      (keyDigits === q ||
        keyDigits.endsWith(q.slice(-8)) ||
        q.endsWith(keyDigits.slice(-8)) ||
        key.toLowerCase().includes(q.slice(-8)))
    ) {
      hits.push(key);
    }
  }
  return [...new Set(hits)];
}

function main() {
  const query = instanceArg || phone;
  if (!query) {
    console.error("Informe --phone ou --instance.");
    process.exit(1);
  }

  const store = readJson(ownersPath, { instances: {}, deletedInstances: {} });
  if (!store.instances) store.instances = {};
  if (!store.deletedInstances) store.deletedInstances = {};

  const keys = findOwnerKeys(store, query);
  if (!keys.length) {
    console.log(JSON.stringify({ ok: false, error: "Nenhuma chave em instance-owners.json", query }, null, 2));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const report = { query, keys, removed: [], tombstoned: [], ownerWarnings: [] };

  for (const key of keys) {
    const owner = String(store.instances[key]?.ownerEmail || "").trim().toLowerCase();
    if (email && owner && owner !== email) {
      report.ownerWarnings.push({ key, owner, expected: email });
    }
    delete store.instances[key];
    report.removed.push(key);
    if (!store.deletedInstances[key]) {
      store.deletedInstances[key] = { deletedAt: now, deletedByScript: true };
      report.tombstoned.push(key);
    }
  }

  if (!dryRun) {
    writeJson(ownersPath, store);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        ownersPath,
        ...report,
        note: dryRun
          ? "Dry-run: nenhuma alteração gravada."
          : "Reinicie o container Node se a UI não refletir (cache ownership).",
      },
      null,
      2,
    ),
  );
}

main();
