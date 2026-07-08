#!/bin/bash
# Correção imediata: wabadisparos.com.br + bet.waba.info (404 Traefik / serviço down).
#
# No VPS (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-wabadisparos-bet-now-vps.sh" -o /root/fix-wabadisparos-bet-now-vps.sh
#   sed -i 's/\r$//' /root/fix-wabadisparos-bet-now-vps.sh
#   chmod +x /root/fix-wabadisparos-bet-now-vps.sh
#   /root/fix-wabadisparos-bet-now-vps.sh
#
# Versão: fix-wabadisparos-bet-2026-07-08-v2
set -euo pipefail

FIX_VERSION="fix-wabadisparos-bet-2026-07-08-v2"
LOG="/var/log/fix-wabadisparos-bet-now.log"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() {
  echo "[$(date -Is)] $*" | tee -a "$LOG"
}

http_public() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$url" 2>/dev/null || echo "000"
}

ensure_script() {
  local name="$1" dest="$2"
  curl -fsSL "${REPO_BASE}/${name}" -o "$dest"
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
}

wake_swarm_service() {
  local svc="$1"
  if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$svc"; then
    log "ERRO: serviço Swarm ${svc} não existe — redeploy no Easypanel (projeto waba)"
    return 1
  fi
  local replicas
  replicas=$(docker service ls --filter "name=^${svc}$" --format '{{.Replicas}}' 2>/dev/null | head -1)
  log "Swarm ${svc}: replicas=${replicas:-?}"
  if [[ "${replicas:-}" == 0/* || "${replicas:-}" == "0/0" ]]; then
    log "Escalando ${svc} → 1"
    timeout 120 docker service scale "${svc}=1" >>"$LOG" 2>&1 || true
    sleep 10
  fi
  log "Force update ${svc}"
  timeout 120 docker service update --force "$svc" >>"$LOG" 2>&1 || true
  sleep 12
  docker service ps "$svc" --no-trunc 2>/dev/null | head -5 | tee -a "$LOG" || true
}

run_landing_fix() {
  local wrapper="$1" label="$2"
  log "=== ${label} ==="
  ensure_script "$(basename "$wrapper")" "$wrapper"
  "$wrapper" run 2>&1 | tee -a "$LOG" || true
}

main() {
  mkdir -p "$(dirname "$LOG")"
  log "=== ${FIX_VERSION} início ==="

  log "Antes:"
  log "  wabadisparos.com.br → $(http_public https://wabadisparos.com.br/)"
  log "  bet.waba.info → $(http_public https://bet.waba.info/)"
  log "  paginadevendas easypanel → $(http_public https://waba-paginadevendas.achpyp.easypanel.host/)"
  log "  bets_pv easypanel → $(http_public https://waba-bets-pv.achpyp.easypanel.host/)"

  wake_swarm_service "waba_paginadevendas" || true

  local bets_ep
  bets_ep=$(http_public https://waba-bets-pv.achpyp.easypanel.host/)
  if [[ "$bets_ep" != "200" ]]; then
    log "bets_pv easypanel=${bets_ep} — tentando subir waba_bets_pv"
    wake_swarm_service "waba_bets_pv" || true
    bets_ep=$(http_public https://waba-bets-pv.achpyp.easypanel.host/)
    log "bets_pv easypanel após wake → ${bets_ep}"
    if [[ "$bets_ep" != "200" ]]; then
      log "AVISO: waba_bets_pv ainda fora — Easypanel → projeto waba → serviço bets_pv → Redeploy"
    fi
  fi

  if [[ -x /root/traefik-permanent-all-vps.sh ]]; then
    log "traefik-permanent-all bootstrap"
    /root/traefik-permanent-all-vps.sh run 2>&1 | tee -a "$LOG" || true
  fi

  if [[ -x /root/restore-landing-routers-vps.sh ]]; then
    /root/restore-landing-routers-vps.sh 2>&1 | tee -a "$LOG" || true
  else
    ensure_script "restore-landing-routers-vps.sh" "/root/restore-landing-routers-vps.sh"
    /root/restore-landing-routers-vps.sh 2>&1 | tee -a "$LOG" || true
  fi

  run_landing_fix "/root/traefik-permanent-paginadevendas-vps.sh" "paginadevendas / wabadisparos.com.br"
  run_landing_fix "/root/traefik-permanent-bets-pv-vps.sh" "bets_pv / bet.waba.info"

  log "Depois:"
  log "  wabadisparos.com.br → $(http_public https://wabadisparos.com.br/)"
  log "  bet.waba.info → $(http_public https://bet.waba.info/)"
  log "  paginadevendas easypanel → $(http_public https://waba-paginadevendas.achpyp.easypanel.host/)"
  log "  bets_pv easypanel → $(http_public https://waba-bets-pv.achpyp.easypanel.host/)"
  log "=== ${FIX_VERSION} fim ==="
}

main "$@"
