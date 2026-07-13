#!/bin/bash
# Purge Admin menus — comandos diretos no container (sem depender do .cjs).
# Uso (root no VPS): bash purge-admin-menus-direct-vps.sh
set -euo pipefail

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1)
echo "CONTAINER=$CONTAINER"
test -n "$CONTAINER"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BK="/app/data/_backups/purge-admin-menus-${STAMP}"

docker exec "$CONTAINER" bash -lc "
set -euo pipefail
DATA=/app/data
BK='$BK'
mkdir -p \"\$BK\"
cd \"\$DATA\"

for f in \
  waba-campaign-intakes.json \
  waba-financeiro-split-settlements.json \
  waba-support-tickets.json \
  waba-push-messages.json \
  waba-master-menu-seen.json \
  disparos-local-state.json
do
  if [ -f \"\$f\" ]; then cp -a \"\$f\" \"\$BK/\"; fi
done

for d in campaign-intakes support-tickets push-media; do
  if [ -d \"\$d\" ]; then cp -a \"\$d\" \"\$BK/\"; fi
done

# NÃO tocar: waba-financeiro-split-config.json, waba-billing-orders.json

node -e \"
const fs=require('fs');
const path=require('path');
const data='/app/data';
const now=new Date().toISOString();
const files={
  'waba-campaign-intakes.json': {version:1,intakes:[]},
  'waba-financeiro-split-settlements.json': {version:1,settlements:[]},
  'waba-support-tickets.json': {version:1,tickets:[]},
  'waba-push-messages.json': {version:1,messages:[]},
  'waba-master-menu-seen.json': {version:1,masters:{}},
  'disparos-local-state.json': {version:1,savedAt:now,campaigns:[],leads:[]},
};
for (const [name,obj] of Object.entries(files)) {
  fs.writeFileSync(path.join(data,name), JSON.stringify(obj,null,2)+'\\n','utf8');
  console.log('wrote', name, fs.statSync(path.join(data,name)).size);
}
\"

for d in campaign-intakes support-tickets push-media; do
  mkdir -p \"\$d\"
  find \"\$d\" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  echo \"wiped \$d/\"
done

echo 'KEEP:'
ls -la waba-financeiro-split-config.json waba-billing-orders.json waba-push-config.json 2>/dev/null || true
echo \"backup -> \$BK\"
"

echo "=== Supabase (se env no container) ==="
docker exec -w /app "$CONTAINER" node -e '
const url=process.env.SUPABASE_URL||"";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
if(!url||!key){ console.log("[supabase] skip — env missing"); process.exit(0); }
const { createClient } = require("@supabase/supabase-js");
const sb=createClient(url,key);
(async()=>{
  const nil="00000000-0000-0000-0000-000000000000";
  let r=await sb.from("disparos_campaign_leads").delete().neq("id",nil);
  if(r.error) throw r.error;
  r=await sb.from("disparos_campaigns").delete().neq("id",nil);
  if(r.error) throw r.error;
  console.log("[supabase] OK — campanhas/leads truncados");
})().catch(e=>{ console.error(e); process.exit(1); });
'

echo "=== Restart container (evita memória regravar) ==="
docker restart "$CONTAINER"
sleep 12

echo "=== Verificação local ==="
docker exec "$CONTAINER" sh -c 'cd /app/data && ls -la waba-campaign-intakes.json waba-push-messages.json waba-support-tickets.json waba-financeiro-split-settlements.json waba-financeiro-split-config.json waba-billing-orders.json'

echo "=== Health público ==="
curl -sS --max-time 15 https://waba.draxsistemas.com.br/health | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
  const h=JSON.parse(s);
  for (const id of ["campaignIntakes","supportTickets","pushMessages","financeiroSettlements","financeiroSplit","billingOrders","disparosLocal"]) {
    const e=(h.dataPersistence&&h.dataPersistence.catalog||[]).find(x=>x.id===id);
    if(!e){ console.log(id, "MISSING"); continue; }
    console.log(id, "size="+e.sizeBytes, "updated="+e.updatedAt);
  }
});
'

echo "[ok] Se intakes/push/tickets/settlements estiverem ~40-80 bytes, purge OK."
