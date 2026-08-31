#!/bin/bash
# Bootstrap Easypanel Traefik — libera porta 80 (docker-proxy zumbi) e sobe easypanel-traefik.
# Incidente 2026-06-20: Traefik 0/1 — address already in use :80 sem container dono.
#
# Uso:
#   source /root/traefik-easypanel-bootstrap-vps.sh && traefik_bootstrap_ensure_traefik
#   /root/traefik-easypanel-bootstrap-vps.sh run
#
# Instalado por: traefik-permanent-all-vps.sh install
# Versão: traefik-bootstrap-2026-06-20-v1
set -euo pipefail

TRAEFIK_BOOTSTRAP_VERSION="${TRAEFIK_BOOTSTRAP_VERSION:-traefik-bootstrap-2026-06-20-v1}"
TRAEFIK_SWARM_SVC="${TRAEFIK_SWARM_SVC:-easypanel-traefik}"
TRAEFIK_BOOTSTRAP_LOG="${TRAEFIK_BOOTSTRAP_LOG:-/var/log/traefik-easypanel-bootstrap.log}"
TRAEFIK_BOOTSTRAP_INSTALL="/root/traefik-easypanel-bootstrap-vps.sh"

traefik_bootstrap_log() {
  echo "[$(date -Is)] [bootstrap] $*" | tee -a "$TRAEFIK_BOOTSTRAP_LOG"
}

traefik_bootstrap_resolve_swarm_service() {
  docker service ls --format '{{.Name}}' 2>/dev/null \
    | grep -iE '^easypanel-traefik$|^easypanel_traefik$' | head -1
}

traefik_bootstrap_proxy_pids_on_port() {
  local port="$1"
  ss -tlnp 2>/dev/null | grep ":${port} " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

traefik_bootstrap_is_docker_proxy() {
  local pid="$1"
  [[ -r "/proc/${pid}/comm" ]] || return 1
  [[ "$(cat "/proc/${pid}/comm" 2>/dev/null)" == "docker-proxy" ]]
}

traefik_bootstrap_traefik_running() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1
}

traefik_bootstrap_port_listening() {
  local port="$1"
  ss -tlnp 2>/dev/null | grep -q ":${port} "
}

# Libera :80/:443 se docker-proxy zumbi prende a porta sem Traefik running.
traefik_bootstrap_free_orphan_host_port() {
  local port="$1"
  local pids pid

  if [[ -n "$(traefik_bootstrap_traefik_running)" ]] && traefik_bootstrap_port_listening "$port"; then
    return 0
  fi

  if ! traefik_bootstrap_port_listening "$port"; then
    return 0
  fi

  pids=$(traefik_bootstrap_proxy_pids_on_port "$port")
  if [[ -z "$pids" ]]; then
    traefik_bootstrap_log "ERRO: porta ${port} em uso por processo não-docker-proxy"
    return 1
  fi

  traefik_bootstrap_log "AVISO: porta ${port} com docker-proxy sem Traefik — liberando (pids: ${pids})"
  for pid in $pids; do
    if traefik_bootstrap_is_docker_proxy "$pid"; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  sleep 1

  if traefik_bootstrap_port_listening "$port"; then
    traefik_bootstrap_log "ERRO: porta ${port} ainda ocupada após kill"
    return 1
  fi

  traefik_bootstrap_log "porta ${port} liberada"
  return 0
}

traefik_bootstrap_cleanup_stale_containers() {
  docker ps -a --filter name=easypanel-traefik -q 2>/dev/null | xargs -r docker rm -f >/dev/null 2>&1 || true
}

traefik_bootstrap_unpause_swarm_update() {
  local svc="$1"
  local state
  state=$(docker service inspect "$svc" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}' 2>/dev/null || true)
  if [[ "$state" == "paused" ]]; then
    traefik_bootstrap_log "AVISO: update Swarm pausado (${svc}) — rollback"
    docker service update --rollback "$svc" >>"$TRAEFIK_BOOTSTRAP_LOG" 2>&1 || true
    sleep 5
  fi
}

traefik_bootstrap_traefik_healthy() {
  [[ -n "$(traefik_bootstrap_traefik_running)" ]] \
    && traefik_bootstrap_port_listening 80 \
    && traefik_bootstrap_port_listening 443
}

# Função principal — idempotente; seguro chamar a cada run/timer.
traefik_bootstrap_ensure_traefik() {
  local svc traefik replicas i

  traefik_bootstrap_free_orphan_host_port 80 || return 1
  traefik_bootstrap_cleanup_stale_containers

  if traefik_bootstrap_traefik_healthy; then
    return 0
  fi

  svc=$(traefik_bootstrap_resolve_swarm_service)
  if [[ -z "$svc" ]]; then
    traefik_bootstrap_log "ERRO: serviço Swarm easypanel-traefik não encontrado — subir no Easypanel"
    return 1
  fi

  traefik_bootstrap_unpause_swarm_update "$svc"

  replicas=$(docker service ls --filter "name=${svc}" --format '{{.Replicas}}' 2>/dev/null || echo "?")
  traefik_bootstrap_log "Traefik down ou :443 ausente (replicas=${replicas}) — force ${svc}"

  timeout 120 docker service update --update-failure-action continue --force "$svc" \
    >>"$TRAEFIK_BOOTSTRAP_LOG" 2>&1 || true

  for i in $(seq 1 12); do
    sleep 5
    if traefik_bootstrap_traefik_healthy; then
      traefik_bootstrap_log "Traefik OK — :80 e :443 escutando"
      return 0
    fi
    if ! traefik_bootstrap_port_listening 80; then
      traefik_bootstrap_free_orphan_host_port 80 || true
      traefik_bootstrap_cleanup_stale_containers
    fi
  done

  traefik_bootstrap_log "ERRO: Traefik ainda down — docker service ps ${svc} --no-trunc | head"
  return 1
}

traefik_bootstrap_run() {
  traefik_bootstrap_log "=== ${TRAEFIK_BOOTSTRAP_VERSION} run ==="
  traefik_bootstrap_ensure_traefik
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-run}" in
    run) traefik_bootstrap_run ;;
    status)
      echo "version=${TRAEFIK_BOOTSTRAP_VERSION}"
      echo "traefik_running=$(traefik_bootstrap_traefik_running || echo none)"
      ss -tlnp 2>/dev/null | grep -E ':80|:443' || echo "ports 80/443: none"
      docker service ls --filter name=easypanel-traefik --format '{{.Name}} {{.Replicas}}' 2>/dev/null || true
      ;;
    *)
      echo "Uso: $0 run | status"
      exit 1
      ;;
  esac
fi
