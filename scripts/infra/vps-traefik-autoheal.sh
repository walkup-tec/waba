#!/bin/bash
# Auto-heal Traefik — WABA + Evolution + landings (bet.waba.info, wabadisparos.com.br).
# Roda no VPS (root). Instalado por install-vps-monitor.sh ou bootstrap-vps-definitivo.sh.
#
# Versão: waba-traefik-autoheal-2026-07-10-v3
set -euo pipefail

AUTOHEAL_VERSION="waba-traefik-autoheal-2026-07-10-v3"
LOG="${WABA_TRAEFIK_AUTOHEAL_LOG:-/var/log/waba-traefik-autoheal.log}"
LOCK_FILE="${WABA_TRAEFIK_AUTOHEAL_LOCK:-/var/run/waba-traefik-autoheal.lock}"
ALL_SCRIPT="${TRAEFIK_ALL_SCRIPT:-/root/traefik-permanent-all-vps.sh}"
BOOTSTRAP="${TRAEFIK_BOOTSTRAP_SCRIPT:-/root/traefik-easypanel-bootstrap-vps.sh}"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
ENTRYPOINT_GUARD="${WABA_ENTRYPOINT_GUARD:-/root/waba-infra/traefik-entrypoint-guard-vps.sh}"
WATCHDOG_443="${WABA_TRAEFIK_443_WATCHDOG:-/root/waba-infra/traefik-443-watchdog-vps.sh}"

PUBLIC_HOSTS=(
  "waba.draxsistemas.com.br|/health"
  "bet.waba.info|/"
  "wabadisparos.com.br|/"
)

log() {
  echo "[$(date -Is)] [$AUTOHEAL_VERSION] $*" | tee -a "$LOG"
}

# Evita "000000" (curl -w 000 + || echo 000)
http_code_local() {
  local host="$1"
  local path="${2:-/}"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
    --resolve "${host}:443:127.0.0.1" \
    "https://${host}${path}" 2>/dev/null || true)"
  [[ -n "$code" ]] || code="000"
  printf '%s\n' "$code"
}

port_443_up() { ss -tlnp 2>/dev/null | grep -q ':443 '; }

check_hosts() {
  local host path code failures=()
  for entry in "${PUBLIC_HOSTS[@]}"; do
    host="${entry%%|*}"
    path="${entry#*|}"
    code="$(http_code_local "$host" "$path")"
    if [[ "$code" =~ ^[23] ]]; then
      log "OK ${host}${path} -> ${code}"
    else
      log "FALHA ${host}${path} -> ${code}"
      failures+=("${host}:${code}")
    fi
  done
  if ((${#failures[@]})); then
    printf '%s\n' "${failures[@]}"
    return 1
  fi
  return 0
}

ensure_all_script() {
  if [[ -x "$ALL_SCRIPT" ]]; then
    return 0
  fi
  log "Instalando ${ALL_SCRIPT} a partir do repositório..."
  curl -fsSL "${REPO_BASE}/traefik-permanent-all-vps.sh" -o "$ALL_SCRIPT"
  sed -i 's/\r$//' "$ALL_SCRIPT" 2>/dev/null || true
  chmod +x "$ALL_SCRIPT"
  "$ALL_SCRIPT" install >>"$LOG" 2>&1 || true
}

run_bootstrap() {
  if [[ ! -x "$BOOTSTRAP" ]]; then
    curl -fsSL "${REPO_BASE}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOTSTRAP" 2>/dev/null || true
    sed -i 's/\r$//' "$BOOTSTRAP" 2>/dev/null || true
    chmod +x "$BOOTSTRAP" 2>/dev/null || true
  fi
  if [[ -x "$BOOTSTRAP" ]]; then
    log "bootstrap Traefik (:443)"
    bash "$BOOTSTRAP" run >>"$LOG" 2>&1 || true
  fi
}

run_heal() {
  ensure_all_script
  if [[ ! -x "$ALL_SCRIPT" ]]; then
    log "ERRO: ${ALL_SCRIPT} ausente — impossível curar"
    return 1
  fi
  log "Executando ${ALL_SCRIPT} run"
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK_FILE" -c "\"$ALL_SCRIPT\" run" >>"$LOG" 2>&1 || true
  else
    "$ALL_SCRIPT" run >>"$LOG" 2>&1 || true
  fi
}

run_entrypoint_guard() {
  local guard="$ENTRYPOINT_GUARD"
  if [[ ! -x "$guard" ]]; then
    mkdir -p /root/waba-infra
    if curl -fsSL "${REPO_BASE}/infra/traefik-entrypoint-guard-vps.sh" -o "$guard" 2>/dev/null; then
      sed -i 's/\r$//' "$guard" 2>/dev/null || true
      chmod +x "$guard"
    else
      log "AVISO: entrypoint guard ausente — skip"
      return 0
    fi
  fi
  log "Rodando entrypoint guard (http/https + backend)"
  bash "$guard" run >>"$LOG" 2>&1 || true
}

cmd_check_and_heal() {
  # Se :443 morto, bootstrap ANTES de qualquer patch de yaml
  if ! port_443_up; then
    log ":443 ausente — bootstrap prioritário"
    run_bootstrap
    sleep 10
  fi

  run_entrypoint_guard

  if check_hosts; then
    return 0
  fi

  # Se todos 000, bootstrap de novo
  if ! port_443_up; then
    run_bootstrap
    sleep 10
  fi

  log "Hosts com falha — iniciando auto-heal"
  run_heal
  sleep 5
  run_entrypoint_guard
  if check_hosts; then
    log "Auto-heal concluído com sucesso"
    return 0
  fi
  log "AVISO: auto-heal executado mas ainda há falhas"
  return 1
}

case "${1:-heal}" in
  check) check_hosts ;;
  heal) cmd_check_and_heal ;;
  force-heal) run_heal ;;
  *)
    echo "Uso: $0 check | heal | force-heal"
    exit 1
    ;;
esac
