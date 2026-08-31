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
# Versão: paginadevendas-green-2026-07-07-v3
# Modos:
#   (padrão)     — diagnóstico + mantém site no ar (pode ficar amarelo se Swarm 0/1)
#   --reconcile-swarm — remove órfão + scale -d para Swarm 1/1 (~30–60s possível blip)
#   --diagnose   — só imprime estado (Swarm, task, health, labels)
set -euo pipefail

VERSION="paginadevendas-green-2026-07-07-v3"
SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
FILTER="${WABA_CONTAINER_FILTER:-waba_paginadevendas}"
PORT="${WABA_PORT:-3000}"
ROUTER="/app/.output/server/_ssr/router-aV5ItMUH.mjs"
LOG="/var/log/fix-paginadevendas-green.log"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

get_replicas() {
  docker service ls --filter "name=${SERVICE}" --format '{{.Replicas}}' 2>/dev/null | head -1 || echo "?"
}

is_swarm_task() {
  local cid="$1" task_id
  task_id=$(docker inspect "$cid" --format '{{index .Config.Labels "com.docker.swarm.task.id"}}' 2>/dev/null || true)
  [[ -n "$task_id" && "$task_id" != "<no value>" ]]
}

print_diagnose() {
  local cid replicas task_id h code_root code_health
  replicas=$(get_replicas)
  cid=$(pick_primary_cid || true)
  log "=== DIAGNÓSTICO ${VERSION} ==="
  log "Swarm replicas: ${replicas}"
  docker service ps "$SERVICE" --no-trunc 2>/dev/null | head -6 | while read -r line; do log "  ps: ${line}"; done
  if [[ -n "$cid" ]]; then
    task_id=$(docker inspect "$cid" --format '{{index .Config.Labels "com.docker.swarm.task.id"}}' 2>/dev/null || echo "")
    h=$(docker_health "$cid")
    code_root=$(http_code_in_container "$cid" "/" || echo "000")
    code_health=$(http_code_in_container "$cid" "/health" || echo "000")
    log "Container: ${cid} task_id=${task_id:-ORFAO} health=${h} GET/=${code_root} GET/health=${code_health}"
    docker service inspect "$SERVICE" --format 'Healthcheck={{json .Spec.TaskTemplate.ContainerSpec.Healthcheck}}' 2>/dev/null | while read -r line; do log "  ${line}"; done
  else
    log "Container: nenhum running"
  fi
  if [[ "$replicas" != "1/1" ]]; then
    log "Easypanel AMARELO: Swarm não está 1/1 (painel ignora container órfão healthy)"
    log "Site pode estar OK via órfão; para VERDE: $0 --reconcile-swarm"
  fi
}

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

scale_service_detach() {
  log "Scale detach: ${SERVICE}=1 (não bloqueia — evita travar terminal)"
  docker service scale -d "${SERVICE}=1" >/dev/null 2>&1 || docker service scale "${SERVICE}=1" >/dev/null 2>&1 &
  sleep 15
}

reconcile_swarm_replicas() {
  local cid="${1:-}" replicas code h
  replicas=$(get_replicas)
  log "Swarm replicas antes: ${replicas}"

  if [[ -n "$cid" ]]; then
    code=$(http_code_in_container "$cid" "/" || echo "000")
    h=$(docker_health "$cid")
    if [[ "$code" == "200" && "$h" == "healthy" && "$(get_replicas)" == "1/1" && is_swarm_task "$cid" ]]; then
      log "Swarm 1/1 + task ativa + HTTP 200 — nada a fazer"
      return 0
    fi
    if [[ "$code" == "200" && "$h" == "healthy" && ! is_swarm_task "$cid" ]]; then
      log "Container healthy mas ÓRFÃO (fora do Swarm) — Easypanel fica amarelo com ${replicas}"
      log "Use: $0 --reconcile-swarm  (blip ~30–60s)"
      return 0
    fi
  fi

  if [[ "$replicas" == "0/1" || "$replicas" == "0/0" ]]; then
    scale_service_detach
  fi
  replicas=$(get_replicas)
  log "Swarm replicas depois: ${replicas}"
}

reconcile_swarm_strict() {
  local i cid replicas h code
  log "=== RECONCILE SWARM (sem --force) ==="
  log "Remove órfãos e recria task Swarm para Easypanel 1/1 — possível blip 30–60s"

  while read -r cid; do
    [[ -z "$cid" ]] && continue
    log "Parando container: ${cid} ($(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||'))"
    docker rm -f "$cid" >/dev/null 2>&1 || true
  done < <(docker ps -q -f "name=${FILTER}")

  scale_service_detach

  for i in $(seq 1 36); do
    replicas=$(get_replicas)
    cid=$(swarm_task_cid || true)
    if [[ -n "$cid" ]]; then
      h=$(docker_health "$cid")
      code=$(http_code_in_container "$cid" "/" || echo "000")
      log "Aguardando (${i}/36) replicas=${replicas} cid=${cid} health=${h} GET/=${code}"
      if [[ "$replicas" == "1/1" && "$h" == "healthy" && "$code" == "200" ]]; then
        log "Swarm 1/1 + healthy — Easypanel deve ficar VERDE em ~1 min"
        return 0
      fi
    else
      log "Aguardando task (${i}/36) replicas=${replicas}"
    fi
    sleep 5
  done

  log "ERRO: reconcile não atingiu 1/1. Saída:"
  docker service ps "$SERVICE" --no-trunc 2>/dev/null | head -8 | while read -r line; do log "  ${line}"; done
  return 1
}

main() {
  local mode="${1:-}"
  case "$mode" in
    --diagnose) print_diagnose; exit 0 ;;
    --reconcile-swarm)
      log "=== ${VERSION} reconcile-swarm ==="
      reconcile_swarm_strict
      exit $?
      ;;
    --help|-h)
      echo "Uso: $0 [--diagnose | --reconcile-swarm]"
      exit 0
      ;;
    "") ;;
    *) log "Opção desconhecida: $mode (use --help)"; exit 2 ;;
  esac

  log "=== ${VERSION} início ==="

  if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SERVICE"; then
    log "ERRO: serviço Swarm '${SERVICE}' não encontrado"
    exit 1
  fi

  local cid
  cid=$(pick_primary_cid || true)
  if [[ -z "$cid" ]]; then
    log "Nenhum container running — scale detach (sem force update)"
    scale_service_detach
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

  reconcile_swarm_replicas "$cid"

  cid=$(pick_primary_cid || true)
  [[ -z "$cid" ]] && { log "ERRO: sem container após reconcile"; exit 1; }

  wait_healthy "$cid" || log "AVISO: healthcheck Docker ainda não healthy (veja abaixo)"

  local code_root code_health h
  code_root=$(http_code_in_container "$cid" "/" || echo "000")
  code_health=$(http_code_in_container "$cid" "/health" || echo "000")
  h=$(docker_health "$cid")
  replicas=$(get_replicas)

  log "=== RESULTADO ==="
  log "  Swarm:     ${replicas}"
  log "  Docker:    Health=${h}"
  log "  GET /:     HTTP ${code_root}"
  log "  GET /health: HTTP ${code_health}"

  if [[ "$code_root" == "200" && "$h" == "healthy" ]]; then
    log "OK — app saudável (HTTP 200, Health=healthy)"
    if [[ "$replicas" == "1/1" ]]; then
      log "Swarm 1/1 — Easypanel deve ficar VERDE em ~1 min"
    elif [[ -n "$cid" ]] && ! is_swarm_task "$cid"; then
      log "Swarm=${replicas} + container ÓRFÃO — Easypanel AMARELO (site OK)"
      log "Para verde: $0 --reconcile-swarm  (~30–60s blip possível)"
    else
      log "Swarm=${replicas} — confira: $0 --diagnose"
    fi
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
