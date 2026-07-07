#!/bin/bash
# Bootstrap DEFINITIVO — instala Traefik permanent (todos os domínios) + monitor + auto-heal.
# Executar UMA VEZ no VPS como root (Hostinger Browser SSH ou SSH):
#
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/infra/bootstrap-vps-definitivo.sh" | bash
#
# Versão: waba-bootstrap-definitivo-2026-07-07-v1
set -euo pipefail

BOOT_VERSION="waba-bootstrap-definitivo-2026-07-07-v1"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
REPO_INFRA="${REPO_BASE}/infra"
LOG="/var/log/waba-bootstrap-definitivo.log"

log() {
  echo "[$(date -Is)] [$BOOT_VERSION] $*" | tee -a "$LOG"
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || {
    echo "Execute como root"
    exit 1
  }
}

fetch_run() {
  local rel="$1"
  local dest="$2"
  local mode="${3:-bash}"
  log "Baixando ${rel} -> ${dest}"
  curl -fsSL "${REPO_BASE}/${rel}" -o "$dest"
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
  if [[ "$mode" == "install" ]]; then
    "$dest" install >>"$LOG" 2>&1
  elif [[ "$mode" == "run" ]]; then
    "$dest" run >>"$LOG" 2>&1 || true
  fi
}

main() {
  require_root
  log "=== Início bootstrap definitivo ==="

  fetch_run "traefik-permanent-all-vps.sh" "/root/traefik-permanent-all-vps.sh" install

  mkdir -p /root/waba-infra
  for script in vps-health-audit.sh vps-cpu-report.sh collect-vps-cpu-metrics-for-waba.sh vps-traefik-autoheal.sh install-vps-monitor.sh; do
    curl -fsSL "${REPO_INFRA}/${script}" -o "/root/waba-infra/${script}"
    sed -i 's/\r$//' "/root/waba-infra/${script}" 2>/dev/null || true
    chmod +x "/root/waba-infra/${script}"
  done

  /root/waba-infra/install-vps-monitor.sh install >>"$LOG" 2>&1

  log "Validação pós-bootstrap:"
  /root/traefik-permanent-all-vps.sh status | tee -a "$LOG" || true
  /root/waba-infra/vps-traefik-autoheal.sh check | tee -a "$LOG" || {
    log "Primeira checagem com falhas — force-heal"
    /root/waba-infra/vps-traefik-autoheal.sh force-heal | tee -a "$LOG" || true
    sleep 8
    /root/waba-infra/vps-traefik-autoheal.sh check | tee -a "$LOG" || true
  }

  log "=== Bootstrap definitivo concluído ==="
  echo ""
  echo "Instalado:"
  echo "  - Traefik permanent ALL (waba + evo + paginadevendas + bets_pv)"
  echo "  - Monitor infra (15 min) + CPU collector (1 min)"
  echo "  - Auto-heal Traefik (2 min) para bet.waba.info e wabadisparos.com.br"
  echo ""
  echo "Logs:"
  echo "  tail -f /var/log/traefik-permanent-all.log"
  echo "  tail -f /var/log/waba-traefik-autoheal.log"
}

main "$@"
