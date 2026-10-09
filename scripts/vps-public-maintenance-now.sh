#!/bin/bash
# VPS — landings em manutenção + tira 502 do Bets (sem Redeploy EasyPanel).
# Causa do 502: waba_bets_pv saudável mas SEM publish :30211 (só 3000/tcp).
# EasyPanel não expõe services bets/paginadevendas no main.yaml — usamos overlay
# (mesmo padrão de sinal-verde.yaml), sem caçar chave no main.
# NÃO mexe em waba_disparador (:30180), Evolution, nem entryPoints.
#
# Cole no SSH (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/vps-public-maintenance-now.sh" -o /tmp/waba-maint.sh
#   sed -i 's/\r$//' /tmp/waba-maint.sh && bash /tmp/waba-maint.sh
#
# Versão: public-maintenance-now-2026-10-09-v3
set -euo pipefail

VERSION="public-maintenance-now-2026-10-09-v3"
CFG_DIR="/etc/easypanel/traefik/config"
CFG="${CFG_DIR}/main.yaml"
OVERLAY="${CFG_DIR}/waba-public-maintenance.yaml"
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
[[ -d "$CFG_DIR" ]] || { echo "ERRO: $CFG_DIR ausente"; exit 1; }

log "=== $VERSION ==="

log "ANTES local :30210=$(http_code http://127.0.0.1:30210/) :30211=$(http_code http://127.0.0.1:30211/) :30180=$(http_code http://127.0.0.1:30180/health)"
log "ANTES https disparos=$(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/) bet=$(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)"
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' | grep -Ei 'bets|paginadevendas|traefik|waba_disparador' | tee -a "$LOG" || true
if [[ -f "$CFG" ]]; then
  log "main.yaml trechos (bet/30211/paginadevendas/30210):"
  grep -nE 'bet\.waba|30211|paginadevendas|30210|wabadisparos' "$CFG" | head -40 | tee -a "$LOG" || log "(nenhum trecho no main.yaml — esperado)"
fi

for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers landings + config-guard OFF"

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
# :30211 é o probe local do monitor WABA; o Swarm bets_pv não publica essa porta (502/ECONNREFUSED).
docker run -d --name waba-maint-bets --restart unless-stopped \
  -p ${BETS_PORT}:80 \
  -p 30211:80 \
  -v "${DIR}:/usr/share/nginx/html:ro" \
  nginx:alpine >/dev/null
sleep 1
log "nginx pv :${PV_PORT}=$(http_code http://127.0.0.1:${PV_PORT}/) bets :${BETS_PORT}=$(http_code http://127.0.0.1:${BETS_PORT}/)"

CERT_RESOLVER=""
CERT_RESOLVER=$(docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE '^TRAEFIK_CERTIFICATESRESOLVERS_' \
  | head -1 \
  | sed -E 's/^TRAEFIK_CERTIFICATESRESOLVERS_([^_]+)_.*/\1/i' \
  | tr '[:upper:]' '[:lower:]' || true)
[[ -n "$CERT_RESOLVER" ]] || CERT_RESOLVER="letsencrypt"
log "certResolver=${CERT_RESOLVER}"

[[ -f "$OVERLAY" ]] && cp -a "$OVERLAY" "${OVERLAY}.bak-${VERSION}-$(date +%s)" || true

python3 - "$OVERLAY" "$BETS_URL" "$PV_URL" "$CERT_RESOLVER" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
bets_url, pv_url, resolver = sys.argv[2:5]

def tls(main, sans):
    out = {"domains": [{"main": main, "sans": sans}]}
    if resolver:
        out["certResolver"] = resolver
    return out

bets_rule = "Host(`bet.waba.info`) || Host(`waba-bets-pv.achpyp.easypanel.host`)"
pv_rule = (
    "Host(`wabadisparos.com.br`) || Host(`www.wabadisparos.com.br`) || "
    "Host(`wabadisparador.com.br`) || Host(`www.wabadisparador.com.br`) || "
    "Host(`waba-paginadevendas.achpyp.easypanel.host`)"
)

data = {
    "http": {
        "routers": {
            "http-waba-maint-bets": {
                "entryPoints": ["http"],
                "service": "waba-maint-bets",
                "rule": bets_rule,
                "priority": 50000,
            },
            "https-waba-maint-bets": {
                "entryPoints": ["https"],
                "service": "waba-maint-bets",
                "rule": bets_rule,
                "priority": 50000,
                "tls": tls("bet.waba.info", ["waba-bets-pv.achpyp.easypanel.host"]),
            },
            "http-waba-maint-pv": {
                "entryPoints": ["http"],
                "service": "waba-maint-pv",
                "rule": pv_rule,
                "priority": 50000,
            },
            "https-waba-maint-pv": {
                "entryPoints": ["https"],
                "service": "waba-maint-pv",
                "rule": pv_rule,
                "priority": 50000,
                "tls": tls(
                    "wabadisparos.com.br",
                    [
                        "www.wabadisparos.com.br",
                        "wabadisparador.com.br",
                        "www.wabadisparador.com.br",
                        "waba-paginadevendas.achpyp.easypanel.host",
                    ],
                ),
            },
        },
        "services": {
            "waba-maint-bets": {
                "loadBalancer": {
                    "servers": [{"url": bets_url}],
                    "passHostHeader": False,
                }
            },
            "waba-maint-pv": {
                "loadBalancer": {
                    "servers": [{"url": pv_url}],
                    "passHostHeader": False,
                }
            },
        },
    }
}
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {path}")
PY

if [[ -f "$CFG" ]]; then
  python3 - "$CFG" "$PV_URL" "$BETS_URL" <<'PY' || true
import sys
from pathlib import Path
path = Path(sys.argv[1])
pv_url, bets_url = sys.argv[2], sys.argv[3]
text = path.read_text(encoding="utf-8")
orig = text
text = text.replace("http://172.17.0.1:30211/", bets_url)
text = text.replace("http://172.17.0.1:30211", bets_url.rstrip("/"))
text = text.replace("http://172.17.0.1:30210/", pv_url)
text = text.replace("http://172.17.0.1:30210", pv_url.rstrip("/"))
if text != orig:
    path.write_text(text, encoding="utf-8")
    print("também atualizou URLs 30210/30211 no main.yaml")
else:
    print("main.yaml sem URL 30210/30211 (ok — overlay basta)")
PY
fi

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
log "HUP Traefik ${cid:0:12} overlay=$OVERLAY"
sleep 8

pv_code="000"
bet_code="000"
for i in 1 2 3 4 5 6; do
  pv_code=$(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/)
  bet_code=$(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)
  if [[ "$pv_code" == "200" && "$bet_code" == "200" ]]; then
    break
  fi
  log "HTTPS ainda disparos=${pv_code} bet=${bet_code} (tentativa ${i}/6)"
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
log "FALHA parcial — log em $LOG overlay=$(ls -l "$OVERLAY" 2>/dev/null || true)"
exit 1
