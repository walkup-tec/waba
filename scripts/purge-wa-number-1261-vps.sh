#!/bin/bash
# Purge número 555182001261 / instância 1261 da EVO + dados locais WABA.
#
# Doc EVO delete: https://doc.evolution-api.com/v2/api-reference/instance-controller/delete-instance
#
# Uso (root no VPS):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/purge-wa-number-1261-vps.sh" \
#     -o /tmp/purge-wa-number-1261-vps.sh
#   sed -i 's/\r$//' /tmp/purge-wa-number-1261-vps.sh
#   chmod +x /tmp/purge-wa-number-1261-vps.sh
#   /tmp/purge-wa-number-1261-vps.sh run
#
set -euo pipefail

EVO_BASE="${EVO_API_URL:-http://172.17.0.1:30181}"
EVO_KEY="${EVO_API_KEY:-429683C4C977415CAAFCCE10F7D57E11}"
TARGET_DIGITS="${PURGE_WA_DIGITS:-555182001261}"
TARGET_INSTANCE="${PURGE_INSTANCE_NAME:-1261}"
WABA_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

digits_only() { echo "$1" | tr -cd '0-9'; }

matches_target() {
  local blob digits
  blob="$(echo "$1" | tr -d '\n')"
  digits="$(digits_only "$blob")"
  # Variantes BR com/sem 9 após DDD
  echo "$blob" | grep -qiE '555182001261|5551982001261|5182001261|51982001261' && return 0
  echo "$digits" | grep -qE '555182001261|5551982001261|5182001261|51982001261' && return 0
  # Nome exato da instância
  echo "$blob" | grep -qiE "\"name\"[[:space:]]*:[[:space:]]*\"${TARGET_INSTANCE}\"" && return 0
  return 1
}

evo_get() {
  curl -sS --max-time 40 -H "apikey: ${EVO_KEY}" "$1"
}

evo_delete_instance() {
  local name enc code
  name="$1"
  enc="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$name" 2>/dev/null || echo "$name")"
  curl -sS --max-time 45 -o /tmp/evo-del-out.json -w '%{http_code}' -X DELETE \
    -H "apikey: ${EVO_KEY}" \
    "${EVO_BASE}/instance/delete/${enc}" || echo "000"
}

purge_evo() {
  log "EVO scan em ${EVO_BASE} por ${TARGET_DIGITS} / ${TARGET_INSTANCE}"
  local raw
  raw="$(evo_get "${EVO_BASE}/instance/fetchInstances" || true)"
  if [[ -z "$raw" || "$raw" == "["* ]] && ! echo "$raw" | grep -q '\['; then
    log "WARN: fetchInstances vazio ou inválido"
  fi
  echo "$raw" > /tmp/evo-fetch-purge.json

  python3 - <<'PY'
import json, re, os, subprocess, sys
path="/tmp/evo-fetch-purge.json"
raw=open(path,"r",encoding="utf-8").read()
try:
  data=json.loads(raw)
except Exception as e:
  print("parse_error", e)
  sys.exit(0)
if isinstance(data, dict):
  data=data.get("response") or data.get("data") or []
if not isinstance(data, list):
  data=[data]
needles=("555182001261","5551982001261","5182001261","51982001261")
target_name=os.environ.get("PURGE_INSTANCE_NAME","1261").lower()
hits=[]
for item in data:
  blob=json.dumps(item, ensure_ascii=False)
  name=str(item.get("name") or item.get("instanceName") or "").strip()
  if any(n in blob for n in needles) or name.lower()==target_name:
    hits.append(name or "?")
print("HITS="+",".join(hits) if hits else "HITS=")
open("/tmp/evo-purge-hits.txt","w",encoding="utf-8").write("\n".join(hits))
PY

  local hits
  hits="$(tr '\n' ' ' < /tmp/evo-purge-hits.txt 2>/dev/null || true)"
  if [[ -z "${hits// }" ]]; then
    log "EVO: nenhum registro com ${TARGET_DIGITS} / ${TARGET_INSTANCE} (já limpo)"
  else
    log "EVO hits: ${hits}"
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      log "DELETE EVO instance: ${name}"
      code="$(evo_delete_instance "$name")"
      log "  HTTP ${code} body=$(head -c 200 /tmp/evo-del-out.json 2>/dev/null || true)"
      # logout best-effort
      curl -sS --max-time 20 -X DELETE -H "apikey: ${EVO_KEY}" \
        "${EVO_BASE}/instance/logout/$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$name")" >/dev/null 2>&1 || true
    done < /tmp/evo-purge-hits.txt
  fi

  # Confirmação final
  raw="$(evo_get "${EVO_BASE}/instance/fetchInstances" || true)"
  if echo "$raw" | grep -qiE '555182001261|5551982001261|5182001261|51982001261|"name"[[:space:]]*:[[:space:]]*"1261"'; then
    log "ERRO: ainda há resquício na EVO após delete"
    return 1
  fi
  # connectionState 1261 deve 404
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -H "apikey: ${EVO_KEY}" \
    "${EVO_BASE}/instance/connectionState/${TARGET_INSTANCE}" || echo 000)"
  log "connectionState/${TARGET_INSTANCE} → HTTP ${code} (esperado 404)"
}

purge_waba_data_in_container() {
  local cid
  cid="$(docker ps -q -f "name=${WABA_SERVICE}" | head -n1 || true)"
  if [[ -z "$cid" ]]; then
    # Swarm task
    cid="$(docker ps -q --filter "label=com.docker.swarm.service.name=${WABA_SERVICE}" | head -n1 || true)"
  fi
  if [[ -z "$cid" ]]; then
    log "WARN: container ${WABA_SERVICE} não encontrado — pulando data local"
    return 0
  fi
  log "WABA container ${cid}: limpando data files de ${TARGET_INSTANCE}"
  docker exec "$cid" node -e '
const fs=require("fs");
const path=require("path");
const dataDir=process.env.WABA_DATA_DIR||"/app/data";
const target="1261";
const needles=["555182001261","5551982001261","5182001261","51982001261","1261"];
function load(p){try{return JSON.parse(fs.readFileSync(p,"utf8"));}catch{return null;}}
function save(p,v){fs.writeFileSync(p,JSON.stringify(v,null,2));}
function scrubObj(obj){
  if(!obj||typeof obj!=="object") return {obj,changed:false};
  let changed=false;
  if(Array.isArray(obj)){
    const next=obj.filter(item=>{
      const blob=JSON.stringify(item);
      return !needles.some(n=>blob.includes(n));
    });
    if(next.length!==obj.length) changed=true;
    return {obj:next,changed};
  }
  const out={...obj};
  for(const k of Object.keys(out)){
    const kl=String(k).toLowerCase();
    if(kl===target||needles.some(n=>kl.includes(n)||String(out[k]).includes(n))){
      // só remove chaves que são o instance name
      if(kl===target || kl.includes("1261")){ delete out[k]; changed=true; }
    }
  }
  if(out.instances && typeof out.instances==="object" && !Array.isArray(out.instances)){
    for(const k of Object.keys(out.instances)){
      if(String(k).toLowerCase()===target){ delete out.instances[k]; changed=true; }
    }
  }
  if(Array.isArray(out.items)){
    const before=out.items.length;
    out.items=out.items.filter(it=>{
      const blob=JSON.stringify(it);
      const name=String(it&& (it.name||it.instanceName)||"").toLowerCase();
      if(name===target) return false;
      return !needles.some(n=>n!=="1261" && blob.includes(n));
    });
    if(out.items.length!==before) changed=true;
  }
  return {obj:out,changed};
}
const files=[
  "instance-owners.json",
  "instance-aliases.json",
  "whatsapp-profile-names.json",
  "evo-instances-cache.json",
  "aquecedor-instance-lifecycle.json",
  "whatsapp-connecting-restriction.json",
  "instancias-uso-config.json",
  "aquecedor-config.json",
];
let report=[];
for(const f of files){
  const p=path.join(dataDir,f);
  if(!fs.existsSync(p)){ report.push(f+": missing"); continue; }
  const raw=load(p);
  if(raw==null){ report.push(f+": unreadable"); continue; }
  // owners map style
  if(f==="instance-owners.json" && raw && typeof raw==="object"){
    let changed=false;
    const root=raw.owners||raw;
    if(root && typeof root==="object"){
      for(const k of Object.keys(root)){
        if(String(k).toLowerCase()===target){ delete root[k]; changed=true; }
      }
    }
    if(Array.isArray(raw.deleted)){
      // keep deleted marker for 1261 — ok
    }
    if(changed){ save(p, raw); report.push(f+": purged owners"); }
    else report.push(f+": ok");
    continue;
  }
  const {obj,changed}=scrubObj(raw);
  if(changed){ save(p,obj); report.push(f+": purged"); }
  else report.push(f+": ok");
}
console.log(report.join("\n"));
'
}

purge_supabase_best_effort() {
  local cid
  cid="$(docker ps -q --filter "label=com.docker.swarm.service.name=${WABA_SERVICE}" | head -n1 || true)"
  [[ -z "$cid" ]] && cid="$(docker ps -q -f "name=${WABA_SERVICE}" | head -n1 || true)"
  [[ -z "$cid" ]] && return 0
  log "Supabase controle_instancia best-effort (se SUPABASE_* no container)"
  docker exec "$cid" node -e '
const { createClient } = require("@supabase/supabase-js");
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||"";
if(!url||!key){ console.log("supabase: skip (no env)"); process.exit(0); }
const sb=createClient(url,key,{auth:{persistSession:false}});
(async()=>{
  const inst="1261";
  const nums=["555182001261","5182001261","51982001261","5551982001261"];
  try {
    await sb.from("controle_instancia").delete().eq("instancia", inst);
    for (const n of nums) {
      await sb.from("controle_instancia").delete().eq("numero_whatsapp", n);
    }
    console.log("supabase: delete attempted for 1261 + numbers");
  } catch(e) {
    console.log("supabase: error", String(e&&e.message||e));
  }
})();
' 2>/dev/null || log "supabase: skip/unavailable"
}

main() {
  case "${1:-run}" in
    run|purge)
      purge_evo
      purge_waba_data_in_container
      purge_supabase_best_effort
      log "Concluído. Confirme na UI: 1261 / 555182001261 não devem aparecer."
      ;;
    evo-only)
      purge_evo
      ;;
    *)
      echo "Uso: $0 run|evo-only"
      exit 1
      ;;
  esac
}

main "$@"
