#!/bin/bash
# Observa reescritas do main.yaml pelo Easypanel e reaplica os fixes Traefik (WABA + Evolution).
# Instalado por traefik-permanent-all-vps.sh install
set -euo pipefail

GUARD_VERSION="traefik-config-guard-2026-06-20-v2"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
CFG_FILE="${CFG_DIR}/main.yaml"
LOG="${TRAEFIK_CONFIG_GUARD_LOG:-/var/log/traefik-easypanel-config-guard.log}"
LOCK_FILE="${TRAEFIK_CONFIG_GUARD_LOCK:-/var/run/traefik-config-guard.lock}"
ALL_SCRIPT="${TRAEFIK_ALL_SCRIPT:-/root/traefik-permanent-all-vps.sh}"
DEBOUNCE_SEC="${TRAEFIK_CONFIG_GUARD_DEBOUNCE_SEC:-2}"

log() {
  echo "[$(date -Is)] $*" | tee -a "$LOG"
}

run_all_fixes() {
  if [[ -x /root/traefik-easypanel-bootstrap-vps.sh ]]; then
    TRAEFIK_BOOTSTRAP_LOG="$LOG"
    # shellcheck disable=SC1090
    source /root/traefik-easypanel-bootstrap-vps.sh
    traefik_bootstrap_ensure_traefik || true
  fi
  if [[ ! -x "$ALL_SCRIPT" ]]; then
    log "ERRO: ${ALL_SCRIPT} ausente — rode traefik-permanent-all-vps.sh install"
    return 1
  fi
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK_FILE" -c "\"$ALL_SCRIPT\" run" >>"$LOG" 2>&1 || true
  else
    "$ALL_SCRIPT" run >>"$LOG" 2>&1 || true
  fi
}

watch_inotify() {
  [[ -f "$CFG_FILE" ]] || { log "ERRO: ${CFG_FILE} não existe"; sleep 30; return 1; }
  if ! command -v inotifywait >/dev/null 2>&1; then
    log "AVISO: inotifywait ausente (apt install inotify-tools) — use apenas timers dos scripts permanentes"
    sleep 3600
    return 1
  fi

  log "=== ${GUARD_VERSION} observando ${CFG_FILE} ==="
  while true; do
    inotifywait -q -e close_write,move_self,attrib,create -t 3600 "$CFG_FILE" 2>/dev/null || {
      sleep 5
      continue
    }
    sleep "$DEBOUNCE_SEC"
    log "main.yaml alterado — executando fixes"
    run_all_fixes
  done
}

case "${1:-watch}" in
  watch) watch_inotify ;;
  run) run_all_fixes ;;
  *)
    echo "Uso: $0 watch | run"
    exit 1
    ;;
esac
