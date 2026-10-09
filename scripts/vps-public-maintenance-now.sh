#!/bin/bash
# VPS — landings em manutenção + tira 502 do Bets (sem Redeploy EasyPanel).
# NÃO mexe em waba_disparador (:30180), Evolution, nem entryPoints.
#
# Cole no SSH (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/vps-public-maintenance-now.sh" -o /tmp/waba-maint.sh
#   sed -i 's/\r$//' /tmp/waba-maint.sh && bash /tmp/waba-maint.sh
#
# Versão: public-maintenance-now-2026-10-09-v1
set -euo pipefail

VERSION="public-maintenance-now-2026-10-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/waba-public-maintenance-now.log"
DIR="/opt/waba-public-maintenance"
HTML_URL="https://raw.githubusercontent.com/walkup-tec/waba/master/public-pages/manutencao.html"
PV_PORT=30290
BETS_PORT=30291
GW="172.17.0.1"
PV_URL="http://${GW}:${PV_PORT}/"
BETS_URL="http://${GW}:${BETS_PORT}/"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

[[ "$(id -u)" -eq 0 ]] || { echo "ERRO: rode como root"; exit 1; }
command -v docker >/dev/null || { echo "ERRO: docker ausente"; exit 1; }
command -v python3 >/dev/null || { echo "ERRO: python3 ausente"; exit 1; }
[[ -f "$CFG" ]] || { echo "ERRO: $CFG ausente"; exit 1; }

log "=== $VERSION ==="

log "ANTES local :30210=$(http_code http://127.0.0.1:30210/) :30211=$(http_code http://127.0.0.1:30211/) :30180=$(http_code http://127.0.0.1:30180/health)"
log "ANTES https disparos=$(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/) bet=$(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)"
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' | grep -Ei 'bets|paginadevendas|traefik|waba_disparador' | tee -a "$LOG" || true

for u in \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers landings OFF (não reverter para o app React)"

mkdir -p "$DIR"
if ! curl -fsSL "$HTML_URL" -o "$DIR/index.html"; then
  log "GitHub indisponível — usando HTML embutido"
  cat >"$DIR/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Site em manutenção</title><meta name="robots" content="noindex, nofollow"/>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#07090c;color:#f4f1ea;padding:2rem}
.card{max-width:36rem;text-align:center;padding:2rem;border:1px solid rgba(251,191,36,.22);border-radius:1.5rem}
</style></head>
<body><main class="card"><h1>Site em manutenção</h1>
<p>Site em manutenção, temporariamente indisponível. Aguarde, em breve novidades!</p></main></body></html>
HTML
fi
grep -q "em breve novidades" "$DIR/index.html" || { log "ERRO: HTML sem a mensagem"; exit 1; }

docker rm -f waba-maint-pv waba-maint-bets >/dev/null 2>&1 || true
docker pull nginx:alpine >/dev/null
docker run -d --name waba-maint-pv --restart unless-stopped \
  -p ${PV_PORT}:80 \
  -v "${DIR}:/usr/share/nginx/html:ro" \
  nginx:alpine >/dev/null
docker run -d --name waba-maint-bets --restart unless-stopped \
  -p ${BETS_PORT}:80 \
  -v "${DIR}:/usr/share/nginx/html:ro" \
  nginx:alpine >/dev/null
sleep 1
log "nginx pv :${PV_PORT}=$(http_code http://127.0.0.1:${PV_PORT}/) bets :${BETS_PORT}=$(http_code http://127.0.0.1:${BETS_PORT}/)"

cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

python3 - "$CFG" "$PV_URL" "$BETS_URL" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
pv_url, bets_url = sys.argv[2], sys.argv[3]
text = path.read_text(encoding="utf-8")

def extract_block(text: str, start: int):
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return text[start:end], start, end

def set_service_url(block: str, url: str) -> str:
    block = re.sub(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
    if "passHostHeader" not in block:
        block = block.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": false,', 1)
    else:
        block = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": false', block, count=1)
    return block

svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{', re.M)
pos = 0
changed = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    if '"loadBalancer"' not in block or '"url"' not in block:
        pos = bend
        continue
    kl = key.lower()
    new_block = block
    if "disparador" in kl or "walkup-evo" in kl or "evolution" in kl:
        pos = bend
        continue
    if "bets" in kl and ("bets_pv" in kl or "bets-pv" in kl):
        new_block = set_service_url(block, bets_url)
        print(f"service {key} -> {bets_url}")
        changed += 1
    elif "paginadevendas" in kl or "pagina-devendas" in kl:
        new_block = set_service_url(block, pv_url)
        print(f"service {key} -> {pv_url}")
        changed += 1
    if new_block != block:
        text = text[:bstart] + new_block + text[bend:]
        pos = bstart + len(new_block)
    else:
        pos = bend

if changed < 1:
    print("ERRO: nenhum service bets/paginadevendas encontrado")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print(f"OK main.yaml ({changed} services)")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
log "HUP Traefik ${cid:0:12}"
sleep 8

pv_code="000"
bet_code="000"
for i in 1 2 3 4 5 6; do
  pv_code=$(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/)
  bet_code=$(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)
  if [[ "$pv_code" == "200" && "$bet_code" == "200" ]]; then
    break
  fi
  log "HTTPS ainda ${pv_code}/${bet_code} (tentativa ${i}/6)"
  sleep 3
done

pv_body=$(curl -sS --max-time 12 --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null | tr -d '\0' | head -c 2500 || true)
bet_body=$(curl -sS --max-time 12 --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/ 2>/dev/null | tr -d '\0' | head -c 2500 || true)
health=$(http_code --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health)

log "DEPOIS disparos=${pv_code} bet=${bet_code} painel/health=${health}"
echo "$pv_body" | grep -q "em breve novidades" && log "disparos: manutenção OK" || log "AVISO: disparos sem a mensagem"
echo "$bet_body" | grep -q "em breve novidades" && log "bet: manutenção OK" || log "AVISO: bet sem a mensagem (${bet_code})"
[[ "$health" == "200" ]] && log "painel WABA intacto" || log "AVISO: health do painel ${health}"

if echo "$bet_body" | grep -q "em breve novidades" && echo "$pv_body" | grep -q "em breve novidades"; then
  log "SUCESSO"
  exit 0
fi
log "FALHA parcial — log em $LOG"
exit 1
