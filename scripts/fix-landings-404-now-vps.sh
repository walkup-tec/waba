#!/bin/bash
# Correção imediata: bet.waba.info + wabadisparos.com.br (404/502).
# Causa típica: Easypanel regenera main.yaml sem Host() público; bets_pv cai.
#
# No PC (PowerShell):
#   scp E:\Waba\scripts\fix-landings-404-now-vps.sh E:\Waba\scripts\restore-landing-routers-vps.sh root@72.60.51.127:/root/
# No VPS:
#   sed -i 's/\r$//' /root/fix-landings-404-now-vps.sh /root/restore-landing-routers-vps.sh
#   chmod +x /root/fix-landings-404-now-vps.sh /root/restore-landing-routers-vps.sh
#   bash /root/fix-landings-404-now-vps.sh
#
# Versão: fix-landings-404-2026-07-09-v1
set -euo pipefail

VERSION="fix-landings-404-2026-07-09-v1"
LOG="/var/log/fix-landings-404-now.log"
RESTORE="/root/restore-landing-routers-vps.sh"
GH="https://raw.githubusercontent.com/walkup-tec/waba/master/scripts"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

ensure_script() {
  local name="$1" dest="$2"
  if [[ -f "$dest" ]]; then return 0; fi
  if [[ -f "/root/${name}" ]]; then cp "/root/${name}" "$dest"; return 0; fi
  curl -fsSL "${GH}/${name}" -o "$dest"
}

require_root() { [[ "$(id -u)" -eq 0 ]] || { echo "ERRO: execute como root"; exit 1; }; }

ensure_traefik() {
  if ss -tln | grep -q ':443 '; then
    log "Traefik :443 OK"
    return 0
  fi
  log "Traefik :443 DOWN — bootstrap"
  if [[ -x /root/traefik-easypanel-bootstrap-vps.sh ]]; then
    bash /root/traefik-easypanel-bootstrap-vps.sh run >>"$LOG" 2>&1 || true
  fi
  for _ in $(seq 1 15); do
    ss -tln | grep -q ':443 ' && { log "Traefik subiu"; return 0; }
    sleep 3
  done
  docker service update --detach=true --force easypanel-traefik >>"$LOG" 2>&1 || true
  sleep 15
  ss -tln | grep -q ':443 ' || { log "ERRO: Traefik ainda sem :443"; exit 1; }
}

restart_if_bad() {
  local svc="$1"
  local rep
  rep=$(docker service ls --format '{{.Name}} {{.Replicas}}' | awk -v s="$svc" '$1==s {print $2}')
  log "service ${svc} replicas=${rep:-?}"
  if [[ "$rep" != "1/1" ]]; then
    log "force update ${svc}"
    docker service update --detach=true --force "$svc" >>"$LOG" 2>&1 || true
    sleep 20
  fi
}

publish_if_missing() {
  local svc="$1" port="$2"
  local has
  has=$(docker service inspect "$svc" --format '{{range .Endpoint.Ports}}{{.PublishedPort}}{{end}}' 2>/dev/null | grep -c "^${port}$" || true)
  if [[ "$has" -eq 0 ]]; then
    log "publish-add ${svc} ${port}->3000/tcp"
    docker service update --detach=true --publish-add "published=${port},target=3000,protocol=tcp" "$svc" >>"$LOG" 2>&1 || true
    sleep 15
  fi
}

main() {
  require_root
  mkdir -p "$(dirname "$LOG")"
  log "=== ${VERSION} início ==="

  ensure_traefik
  restart_if_bad waba_paginadevendas
  restart_if_bad waba_bets_pv

  publish_if_missing waba_paginadevendas 30210
  publish_if_missing waba_bets_pv 30211

  ensure_script "restore-landing-routers-vps.sh" "$RESTORE"
  sed -i 's/\r$//' "$RESTORE" && chmod +x "$RESTORE"

  log "--- restore landing routers (sem reconcile) ---"
  SKIP_RECONCILE=1 bash "$RESTORE" >>"$LOG" 2>&1

  log "=== validação externa (localhost) ==="
  log "  wabadisparos → $(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/)"
  log "  bet.waba.info → $(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)"
  log "  paginadevendas EP → $(http_code --resolve waba-paginadevendas.achpyp.easypanel.host:443:127.0.0.1 https://waba-paginadevendas.achpyp.easypanel.host/)"
  log "  bets EP → $(http_code --resolve waba-bets-pv.achpyp.easypanel.host:443:127.0.0.1 https://waba-bets-pv.achpyp.easypanel.host/)"

  if [[ -x /root/traefik-permanent-all-vps.sh ]]; then
    log "--- reinstalar timers permanent (se existir) ---"
    /root/traefik-permanent-all-vps.sh install >>"$LOG" 2>&1 || true
  fi

  log "=== ${VERSION} fim ==="
  echo ""
  echo "Se ainda 404/502, envie: tail -80 ${LOG}"
}

main "$@"
