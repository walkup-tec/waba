#!/usr/bin/env bash
# Cole INTEIRO no SSH do VPS (srv1261237). Não precisa scp.
# Uso: bash vps-inline-fix-preparing.sh
# Ou: INSTANCE=5182006011 OWNER=mozart.pmo@gmail.com bash vps-inline-fix-preparing.sh

set -euo pipefail
INSTANCE="${INSTANCE:-5182006011}"
OWNER="${OWNER:-mozart.pmo@gmail.com}"

CID="$(docker ps -q -f name=waba_waba_disparador -f status=running | head -1)"
[[ -n "$CID" ]] || { echo "Container não encontrado"; exit 1; }
echo "Container: $CID"

docker exec "$CID" node - "$INSTANCE" "$OWNER" <<'NODE'
const fs = require("fs");
const path = require("path");
const [instance, ownerEmail] = process.argv.slice(2);
const key = String(instance).trim().toLowerCase();
const dataDir = "/app/data";
const now = new Date().toISOString();
const grandfatherCreatedAt = "2026-06-01T12:00:00.000Z";

const readJson = (p, fb) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; }
};
const writeJson = (p, d) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const t = p + ".tmp";
  fs.writeFileSync(t, JSON.stringify(d, null, 2));
  fs.renameSync(t, p);
};

const lifePath = path.join(dataDir, "aquecedor-instance-lifecycle.json");
const life = readJson(lifePath, { version: 1, updatedAt: now, lastStaggerPromotionAt: null, instances: {} });
life.instances = life.instances || {};
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
writeJson(lifePath, life);

const evoPath = path.join(dataDir, "evo-instances-cache.json");
const evo = readJson(evoPath, { items: [] });
evo.items = Array.isArray(evo.items) ? evo.items : [];
let hit = false;
for (const item of evo.items) {
  if (String(item?.name || "").trim().toLowerCase() !== key) continue;
  item.createdAt = grandfatherCreatedAt;
  hit = true;
}
if (!hit) evo.items.push({ name: instance, createdAt: grandfatherCreatedAt });
writeJson(evoPath, evo);

if (ownerEmail && ownerEmail.includes("@")) {
  const op = path.join(dataDir, "instance-owners.json");
  const owners = readJson(op, { instances: {} });
  owners.instances = owners.instances || {};
  owners.instances[instance] = { ownerEmail, createdAt: now, manualActiveOverrideAt: now };
  writeJson(op, owners);
}

console.log(JSON.stringify({ ok: true, instance, phase: "active", evoPatched: true, ownerEmail }, null, 2));
NODE

docker restart "$CID"
sleep 22
curl -sS --max-time 8 http://127.0.0.1:30180/health | head -c 100
echo ""
echo "Feito. Ctrl+F5 em Instâncias (login Mozart)."
