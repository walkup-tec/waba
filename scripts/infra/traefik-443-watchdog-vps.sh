#!/bin/bash
# Watchdog rápido :443 / Traefik — recupera em ~45–60s (não espera 2–15 min).
#
# Quando Traefik cai (0/1 ou :443 ausente), visitantes veem erro de conexão.
# Cache-Control no browser NÃO ajuda (sem TLS). Este script:
#   1) Detecta :443 / container Traefik
#   2) Roda bootstrap (force Swarm se preciso)
#   3) Roda entrypoint guard (http/https + URL 30211)
#   4) Opcional: webhook de alerta (WABA_TRAEFIK_ALERT_WEBHOOK)
#
# Uso (root):
#   bash traefik-443-watchdog-vps.sh run|install|status|check
#
# Versão: traefik-443-watchdog-2026-07-10-v1
set -euo pipefail

VERSION="traefik-443-watchdog-2026-07-10-v1"
LOG="${WABA_TRAEFIK_443_WATCHDOG_LOG:-/var/log/waba-traefik-443-watchdog.log}"
LOCK="${WABA_TRAEFIK_443_WATCHDOG_LOCK:-/var/run/waba-traefik-443-watchdog.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-traefik-443-watchdog.service"
TIMER="waba-traefik-443-watchdog.timer"
BOOTSTRAP="${TRAEFIK_BOOTSTRAP_SCRIPT:-/root/traefik-easypanel-bootstrap-vps.sh}"
ENTRYPOINT_GUARD="${WABA_ENTRYPOINT_GUARD:-/root/waba-infra/traefik-entrypoint-guard-vps.sh}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
ALERT_WEBHOOK="${WABA_TRAEFIK_ALERT_WEBHOOK:-}"
ALERT_STATE="${WABA_TRAEFIK_443_ALERT_STATE:-/var/run/waba-traefik-443-down.flag}"
# Intervalo do timer (segundos entre runs) — padrão 45s
TIMER_SEC="${WABA_TRAEFIK_443_WATCHDOG_SEC:-45}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

port_443_up() { ss -tlnp 2>/dev/null | grep -q ':443 '; }

traefik_container_up() {
  [[ -n "$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)" ]]
}

traefik_replicas_ok() {
  local r
  r="$(docker service ls --filter name=easypanel-traefik --format '{{.Replicas}}' 2>/dev/null | head -1 || true)"
  [[ "$r" == "1/1" ]]
}

https_smoke_ok() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    --resolve wabadisparos.com.br:443:127.0.0.1 \
    https://wabadisparos.com.br/ 2>/dev/null || true)"
  [[ -n "$code" ]] || code="000"
  [[ "$code" =~ ^(200|301|302|304)$ ]]
}

send_alert() {
  local msg="$1"
  log "ALERT: $msg"
  if [[ -n "$ALERT_WEBHOOK" ]]; then
    curl -sS -X POST -H 'Content-Type: application/json' \
      --max-time 8 \
      -d "$(python3 -c 'import json,sys; print(json.dumps({"text":sys.argv[1],"source":"traefik-443-watchdog"}))' "$msg")" \
      "$ALERT_WEBHOOK" >/dev/null 2>&1 || log "webhook falhou"
  fi
  # Marca estado para dedupe (não spam a cada 45s)
  echo "$(date -Is) $msg" >"$ALERT_STATE" 2>/dev/null || true
}

clear_alert_state() {
  if [[ -f "$ALERT_STATE" ]]; then
    log "Traefik recuperado — limpando flag de alerta"
    rm -f "$ALERT_STATE" 2>/dev/null || true
  fi
}

ensure_bootstrap() {
  if [[ -x "$BOOTSTRAP" ]]; then
    return 0
  fi
  log "Baixando bootstrap..."
  curl -fsSL "${REPO_SCRIPTS}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOTSTRAP" || return 1
  sed -i 's/\r$//' "$BOOTSTRAP" 2>/dev/null || true
  chmod +x "$BOOTSTRAP"
}

run_bootstrap() {
  ensure_bootstrap || { log "ERRO: bootstrap ausente"; return 1; }
  log "Executando bootstrap run"
  bash "$BOOTSTRAP" run >>"$LOG" 2>&1 || true
}

run_guard() {
  if [[ ! -x "$ENTRYPOINT_GUARD" ]]; then
    mkdir -p "$(dirname "$ENTRYPOINT_GUARD")"
    curl -fsSL "${REPO_SCRIPTS}/infra/traefik-entrypoint-guard-vps.sh" -o "$ENTRYPOINT_GUARD" 2>/dev/null || true
    sed -i 's/\r$//' "$ENTRYPOINT_GUARD" 2>/dev/null || true
    chmod +x "$ENTRYPOINT_GUARD" 2>/dev/null || true
  fi
  if [[ -x "$ENTRYPOINT_GUARD" ]]; then
    bash "$ENTRYPOINT_GUARD" run >>"$LOG" 2>&1 || true
  fi
}

cmd_check() {
  local ok=1
  port_443_up && traefik_container_up && traefik_replicas_ok || ok=0
  if [[ "$ok" -eq 1 ]] && https_smoke_ok; then
    log "check OK — :443 + Traefik 1/1 + HTTPS smoke"
    return 0
  fi
  log "check FALHA — 443=$(port_443_up && echo up || echo down) container=$(traefik_container_up && echo up || echo down) replicas=$(docker service ls --filter name=easypanel-traefik --format '{{.Replicas}}' 2>/dev/null | head -1)"
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro watchdog em execução — skip"; return 0; }
  fi

  if cmd_check; then
    clear_alert_state
    return 0
  fi

  # Evita spam: só alerta na transição para down
  if [[ ! -f "$ALERT_STATE" ]]; then
    send_alert "Traefik/:443 DOWN no srv1261237 — iniciando bootstrap automático"
  else
    log "ainda down (alerta já enviado) — tentando bootstrap de novo"
  fi

  run_bootstrap
  sleep 8

  if cmd_check; then
    log "recuperado após bootstrap"
    run_guard
    clear_alert_state
    return 0
  fi

  # Segunda tentativa
  run_bootstrap
  sleep 15
  run_guard
  if cmd_check; then
    log "recuperado na 2ª tentativa"
    clear_alert_state
    return 0
  fi

  log "ERRO: Traefik ainda down após bootstrap x2"
  return 1
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/traefik-443-watchdog-vps.sh"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  cp "$src" "$dest"
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=WABA Traefik :443 fast watchdog (bootstrap se cair)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  # systemd OnUnitActiveSec aceita "45s"
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA Traefik :443 watchdog every ${TIMER_SEC}s

[Timer]
OnBootSec=30
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=5s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${TIMER}"
  log "instalado ${TIMER} (intervalo ${TIMER_SEC}s) ${VERSION}"
  rm -f "$LOCK" 2>/dev/null || true
  bash "$dest" run || true
  systemctl status "${TIMER}" --no-pager | head -12 || true
  echo "INSTALLED=${VERSION} interval=${TIMER_SEC}s path=${dest}"
}

cmd_status() {
  systemctl is-active "${TIMER}" 2>/dev/null || echo "timer: inactive"
  systemctl list-timers "${TIMER}" --no-pager 2>/dev/null || true
  cmd_check || true
  tail -20 "$LOG" 2>/dev/null || true
}

case "${1:-run}" in
  check) cmd_check ;;
  run) cmd_run ;;
  install) cmd_install ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 check|run|install|status"
    exit 2
    ;;
esac
