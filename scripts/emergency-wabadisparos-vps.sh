#!/bin/bash
# Emergência: Traefik :443 down + wabadisparos servindo login (backend 30180).
# Cole no VPS: bash emergency-wabadisparos-vps.sh
# Versão: emergency-wabadisparos-2026-07-09-v2
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/emergency-wabadisparos.log"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== emergency start ==="

for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer \
  traefik-permanent-walkup-evo-fix.timer \
  traefik-permanent-paginadevendas-watch \
  traefik-permanent-bets-pv-watch \
  traefik-permanent-waba-watch \
  traefik-permanent-walkup-evo-watch; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers/guard desligados"

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-emergency-$(date +%Y%m%d-%H%M%S)"

# Overlay inalcançável neste VPS → publicar host port + 172.17.0.1
PV_PORT=""
for p in $(docker service inspect waba_paginadevendas --format '{{range .Endpoint.Ports}}{{.PublishedPort}} {{end}}' 2>/dev/null) 30210; do
  [[ -z "$p" ]] && continue
  body=$(curl -sS -m 5 "http://127.0.0.1:${p}/" 2>/dev/null | head -c 200 || true)
  if echo "$body" | grep -qiE 'disparos|cadastro|drax|<!DOCTYPE'; then
    PV_PORT=$p
    break
  fi
done
if [[ -z "$PV_PORT" ]] && ! ss -tln | grep -q ':30210 '; then
  log "publicando waba_paginadevendas 30210->3000"
  docker service update --publish-add mode=host,published=30210,target=3000,protocol=tcp waba_paginadevendas >>"$LOG" 2>&1
  sleep 20
  PV_PORT=30210
fi
[[ -n "$PV_PORT" ]] || { log "ERRO: sem porta landing paginadevendas"; exit 1; }
log "PV_PORT=${PV_PORT}"

python3 - "$CFG" "$PV_PORT" <<'PY'
import re, sys
from pathlib import Path

path, port = Path(sys.argv[1]), sys.argv[2]
text = path.read_text(encoding="utf-8")
pv_url = f"http://172.17.0.1:{port}/"

FIXES = {
    "waba_paginadevendas-0": pv_url,
    "waba_paginadevendas-1": pv_url,
    "waba_paginadevendas-2": pv_url,
    "waba_bets_pv-0": "http://waba_bets_pv:3000/",
    "waba_bets_pv-1": "http://waba_bets_pv:3000/",
    "waba_waba_disparador-0": "http://waba_waba_disparador:80/",
}

for key, url in FIXES.items():
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    print(f"{key}: {'OK' if n else 'skip'}")

path.write_text(text, encoding="utf-8")
print("main.yaml patched")
PY

free_port() {
  local port="$1"
  local pids pid
  pids=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  for pid in $pids; do
    if [[ "$(cat "/proc/${pid}/comm" 2>/dev/null)" == "docker-proxy" ]] \
      && [[ -z "$(docker ps -q -f name=easypanel-traefik -f status=running)" ]]; then
      kill "$pid" 2>/dev/null || true
      log "docker-proxy zumbi pid $pid na :$port"
    fi
  done
}

free_port 80
free_port 443
docker ps -a --filter name=easypanel-traefik -q 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1 || true

if ! ss -tlnp | grep -q ':443 '; then
  log "subindo easypanel-traefik (0/1 ou :443 ausente)"
  timeout 120 docker service update --update-failure-action continue --force easypanel-traefik \
    >>"$LOG" 2>&1 || true
  for i in $(seq 1 20); do
    sleep 3
    ss -tlnp | grep -q ':443 ' && break
  done
fi

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -z "$CID" ]]; then
  log "ERRO: Traefik ainda sem container"
  docker service ps easypanel-traefik --no-trunc | head -5 | tee -a "$LOG"
  exit 1
fi

# File provider watch — aguardar estabilizar; HUP só se :443 sumir após reload
sleep 8
if ss -tlnp | grep -q ':443 '; then
  log "Traefik OK ${CID:0:12} (sem HUP — evita queda pós-reload)"
else
  docker kill -s HUP "$CID" >/dev/null 2>&1 || true
  sleep 8
  log "Traefik HUP ${CID:0:12}"
fi

ss -tlnp | grep -E ':443|:80' | tee -a "$LOG"

CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
  --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null || echo "000")
log "wabadisparos HTTPS: $CODE"

BODY=$(curl -sS --max-time 15 --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null | head -c 400 || true)
if echo "$BODY" | grep -q "Acesso WABA"; then
  log "ERRO: ainda LOGIN — grep url $CFG | grep paginadevendas"
  grep -A6 '"waba_paginadevendas-0"' "$CFG" | tee -a "$LOG"
elif echo "$BODY" | grep -qiE "disparos|cadastro|drax"; then
  log "OK: landing paginadevendas"
else
  log "body: ${BODY:0:120}"
fi

log "=== emergency fim ==="
