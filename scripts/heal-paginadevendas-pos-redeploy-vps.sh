#!/bin/bash
# Heal wabadisparos / waba_paginadevendas APÓS Redeploy Easypanel.
#
# Sintoma clássico (2ª/N-ésima vez):
#   - Browser: 502 ou JSON {"Cannot GET /api/errors/bad-gateway"} (UI Easypanel)
#   - Host EP e domínio custom ambos 502
#   - WABA + bet OK
#
# Causa: publish host :30210 some / Traefik aponta overlay inalcançável.
# NÃO faz force Traefik. NÃO mata docker-proxy.
#
# Uso (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-paginadevendas-pos-redeploy-vps.sh" \
#     -o /tmp/heal-pv.sh
#   sed -i 's/\r$//' /tmp/heal-pv.sh && chmod +x /tmp/heal-pv.sh
#   bash /tmp/heal-pv.sh run
#
# Versão: heal-paginadevendas-pos-redeploy-2026-07-14-v1
set -euo pipefail

VERSION="heal-paginadevendas-pos-redeploy-2026-07-14-v1"
LOG="/var/log/heal-paginadevendas-pos-redeploy.log"
SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
HOST_PORT="${WABA_PV_PUBLISHED_PORT:-30210}"
TARGET_PORT="${WABA_PORT:-3000}"
DOMAIN="${WABA_PUBLIC_HOST:-wabadisparos.com.br}"
REPO="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

log "=== início ==="

if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SERVICE"; then
  log "ERRO: serviço $SERVICE ausente"
  docker service ls | grep -E 'NAME|pagina|waba_' || true
  exit 1
fi

log "replicas: $(docker service ls --filter name="$SERVICE" --format '{{.Replicas}}')"
docker service ps "$SERVICE" --no-trunc 2>/dev/null | head -8 | while read -r line; do log "ps: $line"; done

# 1) Garantir publish host :30210 -> 3000
PORTS_JSON=$(docker service inspect "$SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo "[]")
if echo "$PORTS_JSON" | grep -q "\"PublishedPort\":${HOST_PORT}\|\"PublishedPort\": ${HOST_PORT}"; then
  log "publish :${HOST_PORT} já declarado"
else
  log "publicando ${SERVICE} :${HOST_PORT}->${TARGET_PORT} mode=host"
  docker service update --publish-rm "${HOST_PORT}" "$SERVICE" >>"$LOG" 2>&1 || true
  timeout 120 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$SERVICE" >>"$LOG" 2>&1 || true
  sleep 12
fi

LOCAL=$(http_code "http://127.0.0.1:${HOST_PORT}/")
GW=$(http_code "http://172.17.0.1:${HOST_PORT}/")
log "local :${HOST_PORT}=${LOCAL} gateway=${GW}"

if [[ "$LOCAL" != "200" && "$LOCAL" != "301" && "$LOCAL" != "302" ]]; then
  log "AVISO: backend local ainda !=200 — dump logs"
  docker service logs "$SERVICE" --tail 40 2>&1 | tee -a "$LOG" || true
fi

# 2) Patch Traefik backends + HUP (script canônico landings)
FIX="/tmp/fix-landings-both-heal-pv.sh"
curl -fsSL "${REPO}/fix-landings-both-vps.sh" -o "$FIX"
sed -i 's/\r$//' "$FIX"
chmod +x "$FIX"
log "rodando fix-landings-both"
timeout 90 bash "$FIX" >>"$LOG" 2>&1 || log "AVISO: fix-landings-both exit=$? (seguindo validação)"

sleep 5
PUB=$(http_code "https://${DOMAIN}/")
HEALTH=$(http_code "https://${DOMAIN}/api/health")
EP=$(http_code "https://waba-paginadevendas.achpyp.easypanel.host/")
log "resultado pub=${PUB} /api/health=${HEALTH} easypanel-host=${EP}"

MARKER=$(curl -sS --max-time 12 "https://${DOMAIN}/api/health" 2>/dev/null | head -c 400 || true)
log "health body: ${MARKER}"

if [[ "$PUB" == "200" ]]; then
  log "OK — ${DOMAIN} no ar"
  exit 0
fi

log "AINDA DOWN — cole docker service ps + logs acima"
exit 2
