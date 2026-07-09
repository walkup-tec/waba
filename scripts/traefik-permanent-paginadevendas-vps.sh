#!/bin/bash
# Traefik + Easypanel — landing wabadisparos.com.br (waba/paginadevendas).
# Usa traefik-permanent-waba-vps.sh com variáveis deste serviço.
#
# Uma vez no VPS (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-paginadevendas-vps.sh" -o /root/traefik-permanent-paginadevendas-vps.sh
#   sed -i 's/\r$//' /root/traefik-permanent-paginadevendas-vps.sh
#   chmod +x /root/traefik-permanent-paginadevendas-vps.sh
#   /root/traefik-permanent-paginadevendas-vps.sh install
#
# Versão: paginadevendas-traefik-2026-07-08-v2
set -euo pipefail

PV_VERSION="paginadevendas-traefik-2026-07-08-v2"
INSTALL_PATH="/root/traefik-permanent-paginadevendas-vps.sh"
CRON_FILE="/etc/cron.d/traefik-permanent-paginadevendas-fix"
LOG="/var/log/traefik-permanent-paginadevendas-fix.log"
LOCK_FILE="/var/run/traefik-permanent-paginadevendas-fix.lock"
WABA_CORE="/root/traefik-permanent-waba-vps.sh"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

WATCH_SERVICE="traefik-permanent-paginadevendas-watch.service"
TIMER_SERVICE="traefik-permanent-paginadevendas-fix.timer"
WATCH_UNIT_PATH="/etc/systemd/system/${WATCH_SERVICE}"
TIMER_UNIT_PATH="/etc/systemd/system/${TIMER_SERVICE}"
TIMER_SERVICE_UNIT="/etc/systemd/system/traefik-permanent-paginadevendas-fix.service"

export_waba_env() {
  export WABA_PUBLIC_HOST="${WABA_PUBLIC_HOST:-wabadisparos.com.br}"
  export WABA_SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
  export WABA_CONTAINER_FILTER="${WABA_CONTAINER_FILTER:-waba_paginadevendas}"
  export WABA_EASYPANEL_HOST="${WABA_EASYPANEL_HOST:-waba-paginadevendas.achpyp.easypanel.host}"
  export WABA_NET="${WABA_NET:-easypanel}"
  export WABA_PORT="${WABA_PORT:-3000}"
  export WABA_HOST_PUBLISHED_PORT="${WABA_HOST_PUBLISHED_PORT:-30210}"
  unset WABA_BACKEND_URL
}

ensure_core() {
  echo "Atualizando core Traefik WABA → ${WABA_CORE}"
  curl -fsSL "${REPO_BASE}/traefik-permanent-waba-vps.sh" -o "$WABA_CORE"
  sed -i 's/\r$//' "$WABA_CORE" 2>/dev/null || true
  chmod +x "$WABA_CORE"
}

run_fix() {
  export_waba_env
  ensure_core
  echo "=== ${PV_VERSION} run $(date -Is) host=${WABA_PUBLIC_HOST} ===" | tee -a "$LOG"
  if command -v flock >/dev/null 2>&1; then
    flock -n "$LOCK_FILE" -c "\"$WABA_CORE\" run" | tee -a "$LOG" || true
  else
    "$WABA_CORE" run | tee -a "$LOG" || true
  fi
}

install_watch_service() {
  cat >"$WATCH_UNIT_PATH" <<EOF
[Unit]
Description=Traefik paginadevendas — patch automático em redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=${INSTALL_PATH} watch
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$WATCH_SERVICE"
  echo "Systemd: ${WATCH_SERVICE} ativo"
}

install_timer_service() {
  cat >"$TIMER_SERVICE_UNIT" <<EOF
[Unit]
Description=Traefik paginadevendas — patch periódico

[Service]
Type=oneshot
ExecStart=${INSTALL_PATH} run
EOF

  cat >"$TIMER_UNIT_PATH" <<EOF
[Unit]
Description=Traefik paginadevendas — timer 20s

[Timer]
OnBootSec=20
OnUnitActiveSec=20
AccuracySec=1

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$TIMER_SERVICE"
  echo "Systemd: ${TIMER_SERVICE} ativo (patch a cada 20s)"
}

watch_deploy_events() {
  export_waba_env
  ensure_core
  echo "=== ${PV_VERSION} watch paginadevendas ==="
  docker events --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}}' | while read -r typ action name; do
    [[ -z "$name" ]] && continue
    case "$name" in
      *paginadevendas*|*traefik*|*easypanel*)
        case "${typ}:${action}" in
          container:start|container:die|container:kill|container:destroy|service:update)
            (sleep 3; "$INSTALL_PATH" run >>"$LOG" 2>&1) &
            ;;
        esac
        ;;
    esac
    if [[ "$typ" == "container" && "$action" == health_status:* && "$name" == *paginadevendas* ]]; then
      (sleep 2; "$INSTALL_PATH" run >>"$LOG" 2>&1) &
    fi
  done
}

install_fix() {
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ "$src" != "$INSTALL_PATH" ]]; then
    cp "$src" "$INSTALL_PATH"
    sed -i 's/\r$//' "$INSTALL_PATH" 2>/dev/null || true
    chmod +x "$INSTALL_PATH"
  fi
  ensure_core

  cat >"$CRON_FILE" <<EOF
# Traefik paginadevendas — backup se watcher falhar
* * * * * root ${INSTALL_PATH} run >> ${LOG} 2>&1
EOF
  chmod 644 "$CRON_FILE"

  if command -v systemctl >/dev/null 2>&1; then
    install_watch_service || echo "AVISO: systemd watch falhou"
    install_timer_service || echo "AVISO: systemd timer falhou"
  fi

  run_fix || true

  echo ""
  echo "=== Instalação paginadevendas concluída (${PV_VERSION}) ==="
  echo "  Script:  ${INSTALL_PATH}"
  echo "  Domínio: wabadisparos.com.br"
  echo "  Swarm:   waba_paginadevendas"
  echo "  Log:     ${LOG}"
}

show_status() {
  echo "=== traefik-permanent-paginadevendas status ==="
  for unit in "$WATCH_SERVICE" "$TIMER_SERVICE"; do
    if systemctl list-unit-files "$unit" &>/dev/null 2>&1; then
      printf "  %-45s %s\n" "$unit:" "$(systemctl is-active "$unit" 2>/dev/null || echo inactive)"
    else
      echo "  ${unit}: (não instalado)"
    fi
  done
  [[ -f "$CRON_FILE" ]] && echo "  cron: ${CRON_FILE}" || echo "  cron: ausente"
  [[ -x "$INSTALL_PATH" ]] && echo "  script: ${INSTALL_PATH}" || echo "  script: ausente"
  [[ -x "$WABA_CORE" ]] && echo "  core: ${WABA_CORE}" || echo "  core: ausente"
}

case "${1:-run}" in
  install) install_fix ;;
  run) run_fix ;;
  watch) watch_deploy_events ;;
  status) show_status ;;
  *)
    echo "Uso: $0 install | run | watch | status"
    exit 1
    ;;
esac
