#!/usr/bin/env bash
# Fix definitivo Preparando — aplica patch JS + JSON + restart + verificação
# Cole no SSH: bash vps-fix-preparing-v2.sh
# Vars: INSTANCE=5182006011 OWNER=mozart.pmo@gmail.com

set -euo pipefail
INSTANCE="${INSTANCE:-5182006011}"
OWNER="${OWNER:-mozart.pmo@gmail.com}"

CID="$(docker ps -q -f name=waba_waba_disparador -f status=running | head -1)"
[[ -n "$CID" ]] || { echo "ERRO: container não encontrado"; exit 1; }
echo "=== Container $CID | instância $INSTANCE ==="

docker exec "$CID" node <<'PATCHJS'
const fs = require("fs");
const p = "/app/dist/services/aquecedor-instance-lifecycle.service.js";
let s = fs.readFileSync(p, "utf8");
let changed = false;

if (!s.includes("life?.instances?.[overrideKey]?.manualActiveOverride")) {
  s = s.replace(
    "async function readEvoInstanceCreatedAt(instanceName) {",
    `async function readEvoInstanceCreatedAt(instanceName) {
    const overrideKey = normalizeKey(instanceName);
    try {
        const lifeRaw = await fs_1.promises.readFile(LIFECYCLE_FILE, "utf-8");
        const life = JSON.parse(lifeRaw);
        if (life?.instances?.[overrideKey]?.manualActiveOverride === true)
            return "2026-06-01T12:00:00.000Z";
    }
    catch { }`,
  );
  changed = true;
  console.log("PATCH: readEvoInstanceCreatedAt + manualActiveOverride");
}

if (!s.includes("row.manualActiveOverride === true")) {
  s = s.replace(
    /function shouldRevertGrandfatherToPreparing\(row, createdAt\) \{\s*\n/,
    `function shouldRevertGrandfatherToPreparing(row, createdAt) {
    if (row.manualActiveOverride === true)
        return false;
`,
  );
  changed = true;
  console.log("PATCH: shouldRevertGrandfatherToPreparing");
}

if (!s.includes("function enforceManualActiveOverride")) {
  const inject = `
function enforceManualActiveOverride(row) {
    if (row.manualActiveOverride !== true)
        return false;
    if (row.phase === "active" && !row.preparingSince)
        return false;
    row.phase = "active";
    row.preparingSince = null;
    row.activatedAt = row.activatedAt || new Date().toISOString();
    row.restrictedUntil = null;
    row.restrictedReason = null;
    return true;
}
async function reconcileGrandfatheredActiveRow(instanceName, row) {`;
  s = s.replace("async function reconcileGrandfatheredActiveRow(instanceName, row) {", inject);
  changed = true;
  console.log("PATCH: enforceManualActiveOverride");
}

if (!s.includes("enforceManualActiveOverride(row)")) {
  s = s.replace(
    /for \(const \[key, row\] of Object\.entries\(store\.instances\)\) \{\s+if \(await reconcileGrandfatheredActiveRow\(key, row\)\)/,
    `for (const [key, row] of Object.entries(store.instances)) {
        if (enforceManualActiveOverride(row))
            storeDirty = true;
        if (row.manualActiveOverride === true)
            continue;
        if (await reconcileGrandfatheredActiveRow(key, row))`,
  );
  changed = true;
  console.log("PATCH: getAquecedorLifecycleStatusMap loop");
}

if (changed) fs.writeFileSync(p, s);
else console.log("JS já continha patches");
PATCHJS

docker exec "$CID" node - "$INSTANCE" "$OWNER" <<'PATCHDATA'
const fs=require("fs"),path=require("path");
const [instance,ownerEmail]=process.argv.slice(2);
const key=String(instance).trim().toLowerCase();
const dataDir="/app/data",now=new Date().toISOString(),g="2026-06-01T12:00:00.000Z";
const r=(p,f)=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{return f}};
const w=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+".tmp";fs.writeFileSync(t,JSON.stringify(d,null,2));fs.renameSync(t,p)};
const life=r(path.join(dataDir,"aquecedor-instance-lifecycle.json"),{version:1,updatedAt:now,instances:{}});
life.instances=life.instances||{};
life.instances[key]={phase:"active",preparingSince:null,activatedAt:now,restrictedUntil:null,restrictedReason:null,dailyDate:null,dailySendCount:0,dailyCap:null,manualActiveOverride:true};
life.updatedAt=now;
w(path.join(dataDir,"aquecedor-instance-lifecycle.json"),life);
const evo=r(path.join(dataDir,"evo-instances-cache.json"),{items:[]});
evo.items=Array.isArray(evo.items)?evo.items:[];
let hit=false;
for(const i of evo.items){if(String(i?.name||"").trim().toLowerCase()===key){i.createdAt=g;hit=true;break}}
if(!hit) evo.items.push({name:instance,createdAt:g});
w(path.join(dataDir,"evo-instances-cache.json"),evo);
if(ownerEmail?.includes("@")){const o=r(path.join(dataDir,"instance-owners.json"),{instances:{}});o.instances=o.instances||{};o.instances[instance]={ownerEmail,createdAt:now,manualActiveOverrideAt:now};w(path.join(dataDir,"instance-owners.json"),o);}
console.log("DATA OK", key, life.instances[key].phase);
PATCHDATA

docker restart "$CID"
echo "Aguardando health..."
for i in $(seq 1 30); do
  if curl -sf --max-time 3 http://127.0.0.1:30180/health >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "=== Verificação (simula API uso-config) ==="
docker exec "$CID" node - "$INSTANCE" <<'VERIFY'
const inst = process.argv[2];
const mod = require("/app/dist/services/aquecedor-instance-lifecycle.service.js");
(async () => {
  await mod.registerAquecedorInstancePreparing(inst);
  const map = await mod.getAquecedorLifecycleStatusMap();
  const row = map[String(inst).toLowerCase()];
  console.log(JSON.stringify(row, null, 2));
  if (row?.phase === "preparing" || row?.statusLabel === "Preparando") process.exit(2);
})();
VERIFY

echo ""
echo "OK — Ctrl+F5 na aba Instâncias (login $OWNER)"
