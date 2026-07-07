#!/bin/bash
# Emergência — wabadisparos.com.br 502/404 fora do ar.
# Restaura router SSR limpo + reconcilia Swarm 1/1 + sobe Traefik se necessário.
# NÃO aplica patch OG. NÃO roda traefik-permanent-*.
#
# Uso (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/recover-wabadisparos-502-vps.sh" -o /tmp/recover-502.sh
#   sed -i 's/\r$//' /tmp/recover-502.sh && chmod +x /tmp/recover-502.sh
#   /tmp/recover-502.sh
set -euo pipefail
set +H

VERSION="recover-wabadisparos-502-2026-07-07-v1"
SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
FILTER="${WABA_CONTAINER_FILTER:-waba_paginadevendas}"
ROUTER="/app/.output/server/_ssr/router-aV5ItMUH.mjs"
PORT="${WABA_PORT:-3000}"
SITE="https://wabadisparos.com.br"

log() { echo "[$(date -Is)] $*"; }

http_code_in_container() {
  local cid="$1"
  docker exec "$cid" sh -c "wget -qSO- 'http://127.0.0.1:${PORT}/' 2>&1 | head -1" \
    | awk '/HTTP\// {print $2; exit}' || echo "000"
}

restore_router_from_image() {
  local cid="$1" image tmp
  image=$(docker inspect "$cid" --format '{{.Config.Image}}')
  log "Restaurando router SSR da imagem ${image}..."
  docker rm -f pv-recover-router >/dev/null 2>&1 || true
  docker create --name pv-recover-router "$image" >/dev/null
  tmp=$(mktemp)
  docker cp "pv-recover-router:${ROUTER}" "$tmp"
  docker cp "$tmp" "${cid}:${ROUTER}"
  rm -f "$tmp"
  docker rm pv-recover-router >/dev/null
  docker restart "$cid" >/dev/null
  sleep 18
}

get_replicas() {
  docker service ls --filter "name=${SERVICE}" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo "?"
}

external_code() {
  curl -sS -o /dev/null -w "%{http_code}" "${SITE}/" 2>/dev/null || echo "000"
}

log "=== ${VERSION} ==="
log "Status inicial:"
docker service ls 2>/dev/null | grep -E 'traefik|paginadevendas' || true

CID=$(docker ps -q -f "name=${FILTER}" -f status=running | head -1 || true)
if [[ -n "$CID" ]]; then
  code=$(http_code_in_container "$CID")
  log "Container ${CID} GET/ interno → HTTP ${code}"
  if [[ "$code" != "200" ]]; then
    restore_router_from_image "$CID"
    code=$(http_code_in_container "$CID")
    log "Após restore router → HTTP ${code}"
  fi
else
  log "Nenhum container running"
fi

replicas=$(get_replicas)
log "Swarm replicas: ${replicas}"

if [[ "$replicas" != "1/1" ]]; then
  log "Swarm desincronizado — removendo órfãos e force update (emergência)..."
  docker ps -aq -f "name=${FILTER}" | xargs -r docker rm -f
  docker service update --force "${SERVICE}" >/dev/null

  for i in $(seq 1 30); do
    sleep 5
    replicas=$(get_replicas)
    CID=$(docker ps -q -f "name=${FILTER}" -f status=running | head -1 || true)
    code="000"
    [[ -n "$CID" ]] && code=$(http_code_in_container "$CID")
    log "Aguardando (${i}/30) replicas=${replicas} cid=${CID:-none} GET/=${code}"
    if [[ "$replicas" == "1/1" && -n "$CID" && "$code" == "200" ]]; then
      break
    fi
  done
fi

CID=$(docker ps -q -f "name=${FILTER}" -f status=running | head -1 || true)
ext=$(external_code)
log "Externo antes Traefik: HTTP ${ext}"

if [[ "$ext" != "200" ]]; then
  traefik_rep=$(docker service ls --filter "name=easypanel-traefik" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo "?")
  log "Traefik replicas: ${traefik_rep} — force update 1x (sem traefik-permanent)"
  docker service update --force easypanel-traefik >/dev/null
  for i in $(seq 1 12); do
    sleep 5
    ext=$(external_code)
    log "Aguardando Traefik (${i}/12) externo HTTP ${ext}"
    [[ "$ext" == "200" ]] && break
  done
fi

ext=$(external_code)
log "=== RESULTADO ==="
log "  Swarm:    $(get_replicas)"
log "  Container: ${CID:-none}"
[[ -n "$CID" ]] && log "  Interno:  HTTP $(http_code_in_container "$CID")"
log "  Externo:  HTTP ${ext} ${SITE}/"

if [[ "$ext" == "200" ]]; then
  log "OK — site no ar. NÃO reaplicar patch OG agora."
  exit 0
fi

log "ERRO — ainda fora do ar. Cole saída de:"
log "  docker service ps ${SERVICE} --no-trunc | head -8"
log "  docker logs ${CID:-CONTAINER} --tail 30"
exit 1
