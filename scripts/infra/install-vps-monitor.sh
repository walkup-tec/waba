#!/bin/bash
# Instala monitor periódico de infra WABA no VPS (systemd timer, 15 min)
# Uso (root): bash install-vps-monitor.sh install|status|run-once
# Versão: waba-infra-install-2026-06-27-v1
set -euo pipefail

INSTALL_DIR="/root/waba-infra"
AUDIT_LOG="/var/log/waba-infra-audit.log"
CPU_LOG="/var/log/waba-infra-cpu.log"
SERVICE="waba-infra-audit.service"
TIMER="waba-infra-audit.timer"
UNIT_DIR="/etc/systemd/system"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra}"

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

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR"
  fetch_or_copy "vps-health-audit.sh" "$INSTALL_DIR/vps-health-audit.sh"
  fetch_or_copy "vps-cpu-report.sh" "$INSTALL_DIR/vps-cpu-report.sh"
  fetch_or_copy "collect-vps-cpu-metrics-for-waba.sh" "$INSTALL_DIR/collect-vps-cpu-metrics-for-waba.sh"

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

  echo "Instalado: ${TIMER}, ${CPU_COLLECTOR_TIMER}"
  echo "Logs: ${AUDIT_LOG} ${CPU_LOG}"
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
}

cmd_run_once() {
  bash "${INSTALL_DIR}/vps-health-audit.sh"
  bash "${INSTALL_DIR}/vps-cpu-report.sh"
  bash "${INSTALL_DIR}/collect-vps-cpu-metrics-for-waba.sh" 2>/dev/null || true
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
