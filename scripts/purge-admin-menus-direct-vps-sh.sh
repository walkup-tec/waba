#!/bin/sh
# Purge Admin menus — container SEM bash (só sh).
# Uso (root no VPS): sh purge-admin-menus-direct-vps-sh.sh
set -eu

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1)
echo "CONTAINER=$CONTAINER"
test -n "$CONTAINER"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BK="/app/data/_backups/purge-admin-menus-${STAMP}"

# 1) Backup + write JSON vazios + limpar pastas (via sh + node)
docker exec "$CONTAINER" sh -c "
set -eu
DATA=/app/data
BK=$BK
mkdir -p \"\$BK\"
cd \"\$DATA\"

for f in waba-campaign-intakes.json waba-financeiro-split-settlements.json waba-support-tickets.json waba-push-messages.json waba-master-menu-seen.json disparos-local-state.json; do
  if [ -f \"\$f\" ]; then cp -a \"\$f\" \"\$BK/\"; fi
done

for d in campaign-intakes support-tickets push-media; do
  if [ -d \"\$d\" ]; then cp -a \"\$d\" \"\$BK/\"; fi
done

node -e \"
const fs=require('fs');
const path=require('path');
const data='/app/data';
const now=new Date().toISOString();
const files={
  'waba-campaign-intakes.json':{version:1,intakes:[]},
  'waba-financeiro-split-settlements.json':{version:1,settlements:[]},
  'waba-support-tickets.json':{version:1,tickets:[]},
  'waba-push-messages.json':{version:1,messages:[]},
  'waba-master-menu-seen.json':{version:1,masters:{}},
  'disparos-local-state.json':{version:1,savedAt:now,campaigns:[],leads:[]},
};
for (const [n,o] of Object.entries(files)) {
  fs.writeFileSync(path.join(data,n), JSON.stringify(o,null,2)+String.fromCharCode(10));
  console.log('wrote', n, fs.statSync(path.join(data,n)).size);
}
\"

for d in campaign-intakes support-tickets push-media; do
  mkdir -p \"\$d\"
  # limpa conteúdo sem bash
  if [ -d \"\$d\" ]; then
    for x in \"\$d\"/* \"\$d\"/.[!.]* \"\$d\"/..?*; do
      [ -e \"\$x\" ] || continue
      rm -rf \"\$x\"
    done
  fi
  echo wiped \$d
done

echo KEEP:
ls -la waba-financeiro-split-config.json waba-billing-orders.json waba-push-config.json 2>/dev/null || true
echo backup=\$BK
"

# 2) Supabase
docker exec -w /app "$CONTAINER" node -e '
const url=process.env.SUPABASE_URL||"";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
if(!url||!key){ console.log("[supabase] skip"); process.exit(0); }
const {createClient}=require("@supabase/supabase-js");
const sb=createClient(url,key);
(async()=>{
  const nil="00000000-0000-0000-0000-000000000000";
  let r=await sb.from("disparos_campaign_leads").delete().neq("id",nil);
  if(r.error) throw r.error;
  r=await sb.from("disparos_campaigns").delete().neq("id",nil);
  if(r.error) throw r.error;
  console.log("[supabase] OK");
})().catch(e=>{ console.error(e); process.exit(1); });
'

# 3) Restart
echo "restarting..."
docker restart "$CONTAINER"
sleep 15

# 4) Verify
docker exec "$CONTAINER" sh -c 'cd /app/data && ls -la waba-campaign-intakes.json waba-push-messages.json waba-support-tickets.json waba-financeiro-split-settlements.json waba-financeiro-split-config.json waba-billing-orders.json'

echo "[ok] Esperado: intakes/push/tickets/settlements ~40-80 bytes; split-config e billing-orders grandes."
