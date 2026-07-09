#!/bin/bash
# Diagnóstico Traefik — config em DISCO vs config ATIVA em memória (API).
# NÃO altera nada. Use antes de mais patches no main.yaml.
#
# Doc Traefik API: https://doc.traefik.io/traefik/operations/api/
# File provider: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-diagnose-active-config-vps.sh" -o /tmp/tr-diag.sh
#   sed -i 's/\r$//' /tmp/tr-diag.sh && bash /tmp/tr-diag.sh
#
# Versão: traefik-diagnose-active-config-2026-07-09-v1
set -euo pipefail

VERSION="traefik-diagnose-active-config-2026-07-09-v1"
OUT="${TRAEFIK_DIAG_OUT:-/var/log/traefik-diagnose-active-config.log}"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
CUSTOM="${CFG_DIR}/custom.yaml"
BETS_PUB="bet.waba.info"
DISPAROS_PUB="wabadisparos.com.br"

mkdir -p "$(dirname "$OUT")"
exec > >(tee -a "$OUT") 2>&1

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

log "=== $VERSION ==="

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -z "$CID" ]]; then
  log "ERRO: easypanel-traefik não está running"
  docker service ps easypanel-traefik --no-trunc 2>/dev/null | head -5 || true
  exit 1
fi
log "Traefik container: ${CID:0:12}"

log ""
log "===== CMDLINE ====="
tr '\0' ' ' < "/proc/$(docker inspect -f '{{.State.Pid}}' "$CID")/cmdline" 2>/dev/null || \
  docker inspect "$CID" --format '{{json .Config.Cmd}}' 2>/dev/null || true
echo

log ""
log "===== ARQUIVOS DE CONFIG (host) ====="
find /etc/easypanel/traefik -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.toml' \) 2>/dev/null | sort || true
ls -la "$CFG_DIR" 2>/dev/null || true

log ""
log "===== ARQUIVOS DENTRO DO CONTAINER ====="
docker exec "$CID" sh -c 'find /etc -maxdepth 5 -type f \( -name "*.yml" -o -name "*.yaml" -o -name "*.toml" \) 2>/dev/null | sort' || true

log ""
log "===== PORTAS ====="
ss -tlnp | grep -E ':80 |:443 |:8080 ' || true

log ""
log "===== BACKENDS LOCAIS ====="
for p in 30210 30211 30180; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 6 "http://127.0.0.1:${p}/" 2>/dev/null || echo "000")
  log ":${p}/ → ${code}"
done
code_bets=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 6 "http://127.0.0.1:30180/bets" 2>/dev/null || echo "000")
log ":30180/bets → ${code_bets}"

log ""
log "===== HTTPS PÚBLICO (via Traefik local) ====="
for host in "$BETS_PUB" "$DISPAROS_PUB"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
    --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null || echo "000")
  body=$(curl -sS --max-time 12 --resolve "${host}:443:127.0.0.1" "https://${host}/" 2>/dev/null | head -c 300 || true)
  log "${host} → ${code}"
  log "  body: ${body//$'\n'/ }"
done

log ""
log "===== main.yaml DISCO — ocorrências bets_pv / URLs ====="
if [[ -f "$MAIN" ]]; then
  grep -n "bet\.waba\|bets_pv\|waba_bets" "$MAIN" | head -60 || true
  log ""
  log "--- blocos service waba_bets_pv (DISCO) ---"
  python3 - "$MAIN" <<'PY'
import re, sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r'"(waba[_-]bets[_-]pv[^"]*)"\s*:\s*\{', text, re.I):
    key = m.group(1)
    start = m.start()
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{": depth += 1
        elif ch == "}": 
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[start:end]
    url = re.search(r'"url"\s*:\s*"([^"]+)"', block)
    print(f"\n### {key} @ byte {start}")
    print(f"url: {url.group(1) if url else 'AUSENTE'}")
    print(block[:500])
PY
else
  log "ERRO: $MAIN ausente"
fi

log ""
log "===== DUPLICATAS waba_bets_pv-0 no DISCO ====="
if [[ -f "$MAIN" ]]; then
  grep -n '"waba_bets_pv-0"' "$MAIN" || true
  count=$(grep -c '"waba_bets_pv-0"' "$MAIN" 2>/dev/null || echo 0)
  log "total chaves waba_bets_pv-0: ${count}"
fi

api_fetch() {
  local path="$1"
  docker exec "$CID" sh -c "
    for u in http://127.0.0.1:8080${path} http://127.0.0.1:80${path}; do
      if wget -qO- --timeout=5 \"\$u\" 2>/dev/null; then exit 0; fi
      if wget -qO- --timeout=5 \"https://127.0.0.1:443${path}\" --no-check-certificate 2>/dev/null; then exit 0; fi
    done
    exit 1
  " 2>/dev/null || echo '{"error":"api_unreachable"}'
}

log ""
log "===== TRAEFIK API — routers (MEMÓRIA) ====="
ROUTERS_JSON=$(api_fetch "/api/http/routers")
if echo "$ROUTERS_JSON" | grep -q '"error"'; then
  log "API /api/http/routers indisponível — tentando /api/rawdata"
  RAW=$(api_fetch "/api/rawdata")
  echo "$RAW" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    routers=d.get('routers',{})
    for k,v in sorted(routers.items()):
        if 'bet' in k.lower() or 'bets' in k.lower() or 'bet.waba' in str(v):
            print('---',k,'---')
            print(json.dumps(v,indent=2)[:1200])
except Exception as e:
    print('parse error:',e)
    print(sys.stdin.read()[:2000])
" 2>/dev/null || echo "$RAW" | head -c 3000
else
  echo "$ROUTERS_JSON" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for r in data:
    name=r.get('name','')
    rule=r.get('rule','')
    if 'bet' in name.lower() or 'bet.waba' in rule:
        print('---',name,'---')
        print('rule:',rule)
        print('service:',r.get('service'))
        print('status:',r.get('status'))
        mw=r.get('middlewares') or []
        if mw: print('middlewares:',mw)
" 2>/dev/null || echo "$ROUTERS_JSON" | head -c 3000
fi

log ""
log "===== TRAEFIK API — services (MEMÓRIA) ====="
SERVICES_JSON=$(api_fetch "/api/http/services")
if echo "$SERVICES_JSON" | grep -q '"error"'; then
  RAW=$(api_fetch "/api/rawdata")
  echo "$RAW" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    services=d.get('services',{})
    for k,v in sorted(services.items()):
        if 'bets' in k.lower():
            print('---',k,'---')
            print(json.dumps(v,indent=2)[:1200])
except Exception as e:
    print('parse error:',e)
" 2>/dev/null || true
else
  echo "$SERVICES_JSON" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for s in data:
    name=s.get('name','')
    if 'bets' in name.lower():
        print('---',name,'---')
        print(json.dumps(s.get('loadBalancer') or s, indent=2)[:1200])
" 2>/dev/null || echo "$SERVICES_JSON" | head -c 3000
fi

log ""
log "===== COMPARAR DISCO vs MEMÓRIA (bets_pv URL) ====="
DISK_URLS=$(python3 - "$MAIN" <<'PY' 2>/dev/null || true
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
if not p.exists():
    print("(main.yaml ausente)")
    raise SystemExit(0)
t = p.read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r'"(waba[_-]bets[_-]pv[^"]*)"\s*:\s*\{[\s\S]*?"url"\s*:\s*"([^"]+)"', t, re.I):
    print(f"DISCO {m.group(1)} -> {m.group(2)}")
PY
)
log "$DISK_URLS"

MEM_URLS=$(echo "$SERVICES_JSON" | python3 -c "
import json,sys
try:
    data=json.load(sys.stdin)
    for s in data:
        n=s.get('name','')
        if 'bets' in n.lower():
            lb=s.get('loadBalancer',{})
            for srv in lb.get('servers',[]):
                print(f'MEMORIA {n} -> {srv.get(\"url\",\"?\")}')
except: pass
" 2>/dev/null || echo "(API services indisponível)")
log "$MEM_URLS"

log ""
log "===== INTERPRETAÇÃO RÁPIDA ====="
log "• body '404 page not found' curto = Traefik sem router match"
log "• body HTML grande com 'Bet Waba' ou TanStack = router OK, resposta do APP"
log "• DISCO url != MEMORIA url = patch no arquivo não aplicado (reload/provider)"
log "• múltiplas chaves waba_bets_pv-0 no disco = patch pode alterar bloco errado"
log ""
log "Log completo: $OUT"
log "=== fim $VERSION ==="
