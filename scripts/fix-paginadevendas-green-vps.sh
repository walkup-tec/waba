#!/bin/bash
# Easypanel waba_paginadevendas — deixar VERDE sem recriar o serviço.
#
# O que faz (seguro):
#   - Diagnóstico swarm + healthcheck Docker + HTTP interno
#   - Remove containers órfãos duplicados (mantém a task Swarm ativa)
#   - Restaura router SSR corrompido (500 / SyntaxError) a partir da imagem
#   - Reconcilia réplicas com `docker service scale` (NÃO usa --force)
#
# O que NÃO faz:
#   - docker service update --force waba_paginadevendas
#   - scripts traefik-permanent-* (evita loop / 443 down)
#   - patch OG / alterações de marketing
#
# Uso no VPS (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-paginadevendas-green-vps.sh" -o /tmp/fix-paginadevendas-green.sh
#   sed -i 's/\r$//' /tmp/fix-paginadevendas-green.sh && chmod +x /tmp/fix-paginadevendas-green.sh
#   /tmp/fix-paginadevendas-green.sh
#
# Versão: paginadevendas-green-2026-07-07-v1
set -euo pipefail

VERSION="paginadevendas-green-2026-07-07-v1"
SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
FILTER="${WABA_CONTAINER_FILTER:-waba_paginadevendas}"
PORT="${WABA_PORT:-3000}"
ROUTER="/app/.output/server/_ssr/router-aV5ItMUH.mjs"
LOG="/var/log/fix-paginadevendas-green.log"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

http_code_in_container() {
  local cid="$1" path="$2"
  docker exec "$cid" sh -c "wget -qSO- 'http://127.0.0.1:${PORT}${path}' 2>&1 | head -1" \
    | awk '/HTTP\// {print $2; exit}'
}

docker_health() {
  local cid="$1"
  docker inspect "$cid" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo "unknown"
}

swarm_task_cid() {
  local task_id
  task_id=$(docker service ps "$SERVICE" --filter desired-state=running -q 2>/dev/null | head -1 || true)
  if [[ -z "$task_id" ]]; then
    return 1
  fi
  docker ps -q -f "label=com.docker.swarm.task.id=${task_id}" -f status=running | head -1
}

pick_primary_cid() {
  local cid
  cid=$(swarm_task_cid || true)
  if [[ -n "$cid" ]]; then
    echo "$cid"
    return 0
  fi
  docker ps -q -f "name=${FILTER}" -f status=running | head -1
}

remove_orphan_containers() {
  local keep="$1"
  local removed=0
  local cid
  while read -r cid; do
    [[ -z "$cid" || "$cid" == "$keep" ]] && continue
    log "Removendo órfão: $cid ($(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||'))"
    docker rm -f "$cid" >/dev/null 2>&1 || true
    removed=$((removed + 1))
  done < <(docker ps -q -f "name=${FILTER}")
  log "Órfãos removidos: ${removed}"
}

restore_router_if_broken() {
  local cid="$1"
  local code image tmp
  code=$(http_code_in_container "$cid" "/" || echo "000")
  if [[ "$code" == "200" ]]; then
    log "Homepage OK (HTTP 200) — router intacto"
    return 0
  fi
  log "Homepage HTTP ${code} — restaurando router SSR da imagem..."
  image=$(docker inspect "$cid" --format '{{.Config.Image}}')
  docker rm -f pv-router-green-fix >/dev/null 2>&1 || true
  docker create --name pv-router-green-fix "$image" >/dev/null
  tmp=$(mktemp)
  docker cp "pv-router-green-fix:${ROUTER}" "$tmp"
  docker cp "$tmp" "${cid}:${ROUTER}"
  rm -f "$tmp"
  docker rm pv-router-green-fix >/dev/null
  log "Router restaurado — reiniciando container (não recria serviço Swarm)"
  docker restart "$cid" >/dev/null
  sleep 15
}

wait_healthy() {
  local cid="$1" i h
  for i in $(seq 1 24); do
    h=$(docker_health "$cid")
    log "Health=${h} (tentativa ${i}/24)"
    [[ "$h" == "healthy" ]] && return 0
    sleep 5
  done
  return 1
}

reconcile_swarm_replicas() {
  local replicas
  replicas=$(docker service ls --filter "name=${SERVICE}" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo "?")
  log "Swarm replicas antes: ${replicas}"
  if [[ "$replicas" == "0/1" || "$replicas" == "0/0" ]]; then
    log "Reconciliando: docker service scale ${SERVICE}=1 (sem --force)"
    docker service scale "${SERVICE}=1" >/dev/null
    sleep 20
  fi
  replicas=$(docker service ls --filter "name=${SERVICE}" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo "?")
  log "Swarm replicas depois: ${replicas}"
}

main() {
  log "=== ${VERSION} início ==="

  if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SERVICE"; then
    log "ERRO: serviço Swarm '${SERVICE}' não encontrado"
    exit 1
  fi

  local cid
  cid=$(pick_primary_cid || true)
  if [[ -z "$cid" ]]; then
    log "Nenhum container running — scale 1 (sem force update)"
    docker service scale "${SERVICE}=1" >/dev/null
    sleep 25
    cid=$(pick_primary_cid || true)
  fi
  if [[ -z "$cid" ]]; then
    log "ERRO: ainda sem container após scale. Verifique Easypanel → Logs."
    exit 1
  fi

  log "Container primário: ${cid}"
  remove_orphan_containers "$cid"

  cid=$(pick_primary_cid || true)
  [[ -z "$cid" ]] && { log "ERRO: container primário perdido após limpeza"; exit 1; }

  restore_router_if_broken "$cid"
  cid=$(pick_primary_cid || true)

  reconcile_swarm_replicas

  cid=$(pick_primary_cid || true)
  [[ -z "$cid" ]] && { log "ERRO: sem container após reconcile"; exit 1; }

  wait_healthy "$cid" || log "AVISO: healthcheck Docker ainda não healthy (veja abaixo)"

  local code_root code_health h
  code_root=$(http_code_in_container "$cid" "/" || echo "000")
  code_health=$(http_code_in_container "$cid" "/health" || echo "000")
  h=$(docker_health "$cid")
  replicas=$(docker service ls --filter "name=${SERVICE}" --format '{{.Replicas}}' 2>/dev/null | head -1)

  log "=== RESULTADO ==="
  log "  Swarm:     ${replicas}"
  log "  Docker:    Health=${h}"
  log "  GET /:     HTTP ${code_root}"
  log "  GET /health: HTTP ${code_health}"

  if [[ "$code_root" == "200" && "$h" == "healthy" && "$replicas" == "1/1" ]]; then
    log "OK — Easypanel deve ficar VERDE em ~1 min"
    exit 0
  fi

  if [[ "$code_root" == "200" && "$code_health" == "404" ]]; then
    log "DICA Easypanel: Health Check path provavelmente é /health (404)."
    log "  Painel → waba → paginadevendas → Health Check → Path: /"
    log "  Ou redeploy futuro com endpoint /health na app."
  fi

  if [[ "$replicas" != "1/1" ]]; then
    log "AVISO: Swarm ainda ${replicas}. Easypanel pode permanecer amarelo."
    log "  Envie saída de: docker service ps ${SERVICE} --no-trunc | head -5"
  fi

  exit 1
}

main "$@"
