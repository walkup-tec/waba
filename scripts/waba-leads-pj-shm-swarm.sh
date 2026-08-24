#!/usr/bin/env bash
# Fase B — /dev/shm adequado para Chromium longo (Leads PJ) no Docker Swarm.
# Doc Playwright: https://playwright.dev/docs/docker (--ipc=host / shm)
# Swarm não tem shm_size do Compose; usa-se tmpfs em /dev/shm.
#
# Uso (VPS, root):
#   ./scripts/waba-leads-pj-shm-swarm.sh status
#   ./scripts/waba-leads-pj-shm-swarm.sh apply
#
# Depois no EasyPanel (waba_disparador):
#   CASADOSDADOS_USE_DEV_SHM=1
#   memória do serviço >= 4GB recomendado
set -euo pipefail

SERVICE="${WABA_DISPARADOR_SERVICE:-waba_disparador}"
SHM_SIZE="${WABA_LEADS_SHM_SIZE:-2147483648}" # 2 GiB

cmd_status() {
  echo "== service: ${SERVICE} =="
  docker service inspect "$SERVICE" --format '{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}' 2>/dev/null | head -c 2000 || true
  echo
  echo "== /dev/shm dentro da task (se houver) =="
  local cid
  cid="$(docker ps -q -f name="${SERVICE}" | head -n1 || true)"
  if [[ -n "${cid}" ]]; then
    docker exec "$cid" sh -c 'df -h /dev/shm; mount | grep -E "shm|/dev/shm" || true' || true
  else
    echo "(nenhum container running com name ${SERVICE})"
  fi
}

cmd_apply() {
  echo "Aplicando tmpfs /dev/shm size=${SHM_SIZE} em ${SERVICE}…"
  echo "Impacto: rolling update do serviço; sites WABA podem oscilar ~1 min."
  echo "Memória: NÃO alterada por este script — ajuste >=4GB no EasyPanel se possível."
  # Remove mount antigo de /dev/shm se existir (best-effort) e adiciona tmpfs.
  docker service update \
    --mount-rm "/dev/shm" \
    "$SERVICE" >/dev/null 2>&1 || true
  docker service update \
    --mount-add "type=tmpfs,destination=/dev/shm,tmpfs-size=${SHM_SIZE}" \
    "$SERVICE"
  echo "OK. No EasyPanel (waba_disparador): CASADOSDADOS_USE_DEV_SHM=1 e RAM confortável (>=4GB)."
  echo "Validar: $0 status"
}

case "${1:-status}" in
  status) cmd_status ;;
  apply) cmd_apply ;;
  *)
    echo "Uso: $0 status|apply"
    exit 1
    ;;
esac
