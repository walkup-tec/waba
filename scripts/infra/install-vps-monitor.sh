#!/bin/bash
# Instala monitor periódico de infra WABA no VPS (systemd timer, 15 min)
# Uso (root): bash install-vps-monitor.sh install|status|run-once
# Versão: waba-infra-install-2026-07-10-v3
set -euo pipefail

INSTALL_DIR="/root/waba-infra"
AUDIT_LOG="/var/log/waba-infra-audit.log"
CPU_LOG="/var/log/waba-infra-cpu.log"
SERVICE="waba-infra-audit.service"
TIMER="waba-infra-audit.timer"
UNIT_DIR="/etc/systemd/system"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
TRAEFIK_ALL="/root/traefik-permanent-all-vps.sh"
AUTOHEAL_SCRIPT="${INSTALL_DIR}/vps-traefik-autoheal.sh"
AUTOHEAL_SERVICE="waba-traefik-autoheal.service"
AUTOHEAL_TIMER="waba-traefik-autoheal.timer"
ENTRYPOINT_GUARD_SCRIPT="${INSTALL_DIR}/traefik-entrypoint-guard-vps.sh"

script_dir() {
  dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
}

fetch_or_copy() {
  local name="$1"
  local dest="$2"
  local src
  src="$(script_dir)/${name}"
  if [[ -f "$src" ]]; then
    cp "$src" "$dest"
  else
    curl -fsSL "${REPO_BASE}/${name}" -o "$dest"
  fi
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
}

ensure_traefik_permanent_all() {
  if [[ -x "$TRAEFIK_ALL" ]]; then
    echo "Traefik permanent já instalado: ${TRAEFIK_ALL}"
    "$TRAEFIK_ALL" install >>"${AUDIT_LOG}" 2>&1 || true
    return 0
  fi
  echo "Instalando Traefik permanent ALL (waba + evo + landings)..."
  curl -fsSL "${REPO_SCRIPTS}/traefik-permanent-all-vps.sh" -o "$TRAEFIK_ALL"
  sed -i 's/\r$//' "$TRAEFIK_ALL" 2>/dev/null || true
  chmod +x "$TRAEFIK_ALL"
  "$TRAEFIK_ALL" install >>"${AUDIT_LOG}" 2>&1 || true
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR"
  fetch_or_copy "vps-health-audit.sh" "$INSTALL_DIR/vps-health-audit.sh"
  fetch_or_copy "vps-cpu-report.sh" "$INSTALL_DIR/vps-cpu-report.sh"
  fetch_or_copy "collect-vps-cpu-metrics-for-waba.sh" "$INSTALL_DIR/collect-vps-cpu-metrics-for-waba.sh"
  fetch_or_copy "vps-traefik-autoheal.sh" "$AUTOHEAL_SCRIPT"
  fetch_or_copy "traefik-entrypoint-guard-vps.sh" "$ENTRYPOINT_GUARD_SCRIPT"
  ensure_traefik_permanent_all

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=WABA infrastructure health audit
After=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'echo "--- \$(date -u +%Y-%m-%dT%H:%M:%SZ) ---" >> ${AUDIT_LOG}; ${INSTALL_DIR}/vps-health-audit.sh >> ${AUDIT_LOG} 2>&1 || true; echo "--- CPU ---" >> ${CPU_LOG}; ${INSTALL_DIR}/vps-cpu-report.sh --alert-load 8 >> ${CPU_LOG} 2>&1 || true'
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Run WABA infra audit every 15 minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=15min
AccuracySec=1min
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${TIMER}"

  local CPU_COLLECTOR_SERVICE="waba-infra-cpu-collector.service"
  local CPU_COLLECTOR_TIMER="waba-infra-cpu-collector.timer"

  cat >"${UNIT_DIR}/${CPU_COLLECTOR_SERVICE}" <<EOF
[Unit]
Description=WABA CPU metrics collector for Monitor CPU UI
After=docker.service

[Service]
Type=oneshot
ExecStart=${INSTALL_DIR}/collect-vps-cpu-metrics-for-waba.sh
EOF

  cat >"${UNIT_DIR}/${CPU_COLLECTOR_TIMER}" <<EOF
[Unit]
Description=Collect VPS CPU metrics every minute for WABA master UI

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${CPU_COLLECTOR_TIMER}"
  bash "$INSTALL_DIR/collect-vps-cpu-metrics-for-waba.sh" || true

  cat >"${UNIT_DIR}/${AUTOHEAL_SERVICE}" <<EOF
[Unit]
Description=WABA Traefik auto-heal (bet.waba.info + wabadisparos.com.br)
After=docker.service

[Service]
Type=oneshot
ExecStart=${AUTOHEAL_SCRIPT} heal
EOF

  cat >"${UNIT_DIR}/${AUTOHEAL_TIMER}" <<EOF
[Unit]
Description=Traefik auto-heal a cada 2 minutos

[Timer]
OnBootSec=45
OnUnitActiveSec=2min
AccuracySec=15s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${AUTOHEAL_TIMER}"
  bash "$AUTOHEAL_SCRIPT" heal || true

  # Guard entryPoints http/https (nunca web/websecure) — incidente bet 2026-07-10
  bash "$ENTRYPOINT_GUARD_SCRIPT" install || true

  echo "Instalado: ${TIMER}, ${CPU_COLLECTOR_TIMER}, ${AUTOHEAL_TIMER}, waba-traefik-entrypoint-guard.timer"
  echo "Logs: ${AUDIT_LOG} ${CPU_LOG} /var/log/waba-traefik-autoheal.log /var/log/waba-traefik-entrypoint-guard.log"
  bash "$INSTALL_DIR/vps-health-audit.sh" || true
}

cmd_status() {
  systemctl status "${TIMER}" --no-pager 2>/dev/null || echo "Timer não instalado"
  echo "--- tail audit ---"
  tail -20 "${AUDIT_LOG}" 2>/dev/null || echo "(sem log ainda)"
  echo "--- tail cpu ---"
  tail -15 "${CPU_LOG}" 2>/dev/null || echo "(sem log ainda)"
  echo "--- cpu collector timer ---"
  systemctl status waba-infra-cpu-collector.timer --no-pager 2>/dev/null || echo "(timer cpu collector não instalado)"
  echo "--- traefik autoheal timer ---"
  systemctl status waba-traefik-autoheal.timer --no-pager 2>/dev/null || echo "(timer autoheal não instalado)"
  echo "--- traefik entrypoint guard ---"
  systemctl status waba-traefik-entrypoint-guard.timer --no-pager 2>/dev/null || echo "(timer entrypoint guard não instalado)"
  bash "${INSTALL_DIR}/traefik-entrypoint-guard-vps.sh" status 2>/dev/null || true
  echo "--- tail traefik autoheal ---"
  tail -15 /var/log/waba-traefik-autoheal.log 2>/dev/null || echo "(sem log autoheal ainda)"
  echo "--- tail entrypoint guard ---"
  tail -15 /var/log/waba-traefik-entrypoint-guard.log 2>/dev/null || echo "(sem log entrypoint guard ainda)"
}

cmd_run_once() {
  bash "${INSTALL_DIR}/vps-health-audit.sh"
  bash "${INSTALL_DIR}/vps-cpu-report.sh"
  bash "${INSTALL_DIR}/collect-vps-cpu-metrics-for-waba.sh" 2>/dev/null || true
  bash "${AUTOHEAL_SCRIPT}" heal 2>/dev/null || true
  bash "${ENTRYPOINT_GUARD_SCRIPT}" run 2>/dev/null || true
}

case "${1:-}" in
  install) cmd_install ;;
  status) cmd_status ;;
  run-once) cmd_run_once ;;
  *)
    echo "Uso: $0 install|status|run-once"
    exit 1
    ;;
esac
