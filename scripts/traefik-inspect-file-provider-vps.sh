#!/bin/bash
# Diagnóstico: Traefik file provider = filename ou directory?
# NÃO altera nada. Doc: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# Uso:
#   bash /tmp/traefik-inspect-file-provider-vps.sh
#
# Versão: traefik-inspect-file-provider-2026-07-20-v1
set -euo pipefail

VERSION="traefik-inspect-file-provider-2026-07-20-v1"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
OUT="${TRAEFIK_INSPECT_OUT:-/var/log/traefik-inspect-file-provider.log}"

mkdir -p "$(dirname "$OUT")"
exec > >(tee -a "$OUT") 2>&1

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }

log "=== $VERSION ==="
log "CFG_DIR=$CFG_DIR"
ls -la "$CFG_DIR" 2>/dev/null || log "CFG_DIR ausente"

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1 || true)
if [[ -z "${CID:-}" ]]; then
  log "ERRO: easypanel-traefik sem container running"
  docker service ps easypanel-traefik --no-trunc 2>/dev/null | head -6 || true
  exit 1
fi
log "container=${CID:0:12}"

log ""
log "===== ENV providers.file (service) ====="
docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'PROVIDERS\.FILE|providers\.file|FILE_FILENAME|FILE_DIRECTORY|FILE_WATCH' || log "(nenhum TRAEFIK_PROVIDERS_FILE_* no service env)"

log ""
log "===== ENV providers.file (container) ====="
docker inspect "$CID" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -iE 'PROVIDERS\.FILE|providers\.file|FILE_FILENAME|FILE_DIRECTORY|FILE_WATCH' || log "(nenhum no container env)"

log ""
log "===== Args / Labels ====="
docker service inspect easypanel-traefik --format '{{json .Spec.TaskTemplate.ContainerSpec.Args}}' 2>/dev/null || true
echo
docker service inspect easypanel-traefik --format '{{range $k,$v := .Spec.Labels}}{{println $k $v}}{{end}}' 2>/dev/null \
  | grep -iE 'traefik|provider|file' || true

log ""
log "===== Mounts ====="
docker inspect "$CID" --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' 2>/dev/null || true

log ""
log "===== Arquivos yaml em config/ ====="
find "$CFG_DIR" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort || true

MODE="unknown"
if docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -qiE 'TRAEFIK_PROVIDERS_FILE_DIRECTORY='; then
  MODE="directory"
elif docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -qiE 'TRAEFIK_PROVIDERS_FILE_FILENAME='; then
  MODE="filename"
elif docker inspect "$CID" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -qiE 'TRAEFIK_PROVIDERS_FILE_DIRECTORY='; then
  MODE="directory"
elif docker inspect "$CID" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
  | grep -qiE 'TRAEFIK_PROVIDERS_FILE_FILENAME='; then
  MODE="filename"
fi

# Heurística: se main.yaml + custom.yaml + (possível) outros e não há FILENAME explícito
if [[ "$MODE" == "unknown" ]]; then
  n=$(find "$CFG_DIR" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | wc -l | tr -d ' ')
  if [[ "${n:-0}" -gt 1 ]]; then
    log "HEURÍSTICA: ${n} yamls em config/ — Easypanel costuma usar directory=/data/config"
    MODE="directory-likely"
  else
    MODE="filename-likely"
  fi
fi

log ""
log "===== VEREDICTO ====="
log "MODE=$MODE"
log "Doc: filename e directory são mutuamente exclusivos; preferir directory + watch=true"
log "Próximo: scripts/traefik-split-sinal-verde-yaml-vps.sh"
echo "MODE=$MODE"
