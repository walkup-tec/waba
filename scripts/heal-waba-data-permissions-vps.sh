#!/usr/bin/env bash
# Corrige EACCES em /app/data (ficheiros root-owned após docker cp / purge).
# Uso no VPS (root):
#   curl -fsSL .../heal-waba-data-permissions-vps.sh | bash
#   ou: bash heal-waba-data-permissions-vps.sh run
set -euo pipefail

WABA_SERVICE="${WABA_SERVICE:-waba_disparador}"
DATA_DIR="${WABA_DATA_DIR:-/app/data}"
APP_UID="${WABA_APP_UID:-1001}"
APP_GID="${WABA_APP_GID:-1001}"

log() { echo "[heal-waba-data-perm] $*"; }

find_cid() {
  docker ps --filter "name=${WABA_SERVICE}" --format '{{.ID}}' | head -n1
}

main() {
  local mode="${1:-run}"
  local cid
  cid="$(find_cid)"
  if [[ -z "$cid" ]]; then
    log "ERROR: container de ${WABA_SERVICE} não encontrado"
    exit 2
  fi
  log "container=$cid data=$DATA_DIR uid:gid=${APP_UID}:${APP_GID}"

  if [[ "$mode" == "status" ]]; then
    docker exec "$cid" sh -c "ls -la '${DATA_DIR}/instance-owners.json' '${DATA_DIR}' | head -n 30"
    exit 0
  fi

  if [[ "$mode" != "run" ]]; then
    log "Uso: $0 run|status"
    exit 1
  fi

  docker exec -u 0 "$cid" sh -c \
    "chown -R ${APP_UID}:${APP_GID} '${DATA_DIR}' && chmod -R u+rwX '${DATA_DIR}'"
  docker exec "$cid" sh -c \
    "touch '${DATA_DIR}/.waba-write-probe' && rm -f '${DATA_DIR}/.waba-write-probe' && echo WRITE_OK"
  docker exec "$cid" sh -c "ls -la '${DATA_DIR}/instance-owners.json'"
  log "DONE"
}

main "$@"
