#!/bin/bash
# Instalação definitiva Traefik + Easypanel — WABA + Evolution API (walkup).
# Corrige 404/502 após redeploy + bootstrap Traefik (porta 80 zumbi, proxy down).
#
# Uma vez no VPS (como root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-all-vps.sh" -o /root/traefik-permanent-all-vps.sh
#   sed -i 's/\r$//' /root/traefik-permanent-all-vps.sh
#   chmod +x /root/traefik-permanent-all-vps.sh
#   /root/traefik-permanent-all-vps.sh install
#
# Versão: traefik-permanent-all-2026-07-07-v4
set -euo pipefail

ALL_VERSION="traefik-permanent-all-2026-07-07-v4"
WABA_SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
WABA_HOST_PUBLISHED_PORT="${WABA_HOST_PUBLISHED_PORT:-30180}"
INSTALL_PATH="/root/traefik-permanent-all-vps.sh"
BOOTSTRAP_SCRIPT="/root/traefik-easypanel-bootstrap-vps.sh"
REPO_BASE="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

WABA_SCRIPT="/root/traefik-permanent-waba-vps.sh"
EVO_SCRIPT="/root/traefik-permanent-walkup-evo-vps.sh"
PV_SCRIPT="/root/traefik-permanent-paginadevendas-vps.sh"
BETS_SCRIPT="/root/traefik-permanent-bets-pv-vps.sh"
GUARD_SCRIPT="/root/traefik-easypanel-config-guard.sh"
RESTORE_WABA="/root/restore-waba-traefik-router-vps.sh"
RESTORE_EVO="/root/restore-walkup-evo-traefik-router-vps.sh"

GUARD_SERVICE="traefik-easypanel-config-guard.service"
BOOTSTRAP_TIMER="traefik-easypanel-bootstrap.timer"
GUARD_UNIT="/etc/systemd/system/${GUARD_SERVICE}"
LOG="/var/log/traefik-permanent-all.log"

script_dir() {
  dirname "$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
}

copy_local_or_curl() {
  local name="$1"
  local dest="$2"
  local src
  src="$(script_dir)/${name}"
  if [[ -f "$src" ]]; then
    local src_real dest_real
    src_real=$(readlink -f "$src" 2>/dev/null || echo "$src")
    dest_real=$(readlink -f "$dest" 2>/dev/null || echo "$dest")
    if [[ "$src_real" != "$dest_real" ]]; then
      cp "$src" "$dest"
    fi
  else
    curl -fsSL "${REPO_BASE}/${name}" -o "$dest"
  fi
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"
}

load_bootstrap() {
  [[ -f "$BOOTSTRAP_SCRIPT" ]] || return 1
  TRAEFIK_BOOTSTRAP_LOG="$LOG"
  # shellcheck disable=SC1090
  source "$BOOTSTRAP_SCRIPT"
}

install_scripts() {
  echo "=== ${ALL_VERSION} — copiando scripts para /root ==="
  copy_local_or_curl "traefik-easypanel-bootstrap-vps.sh" "$BOOTSTRAP_SCRIPT"
  copy_local_or_curl "traefik-permanent-waba-vps.sh" "$WABA_SCRIPT"
  copy_local_or_curl "traefik-permanent-walkup-evo-vps.sh" "$EVO_SCRIPT"
  copy_local_or_curl "traefik-permanent-paginadevendas-vps.sh" "$PV_SCRIPT"
  copy_local_or_curl "traefik-permanent-bets-pv-vps.sh" "$BETS_SCRIPT"
  copy_local_or_curl "traefik-easypanel-config-guard.sh" "$GUARD_SCRIPT"
  copy_local_or_curl "restore-waba-traefik-router-vps.sh" "$RESTORE_WABA"
  copy_local_or_curl "restore-walkup-evo-traefik-router-vps.sh" "$RESTORE_EVO"

  local self_src
  self_src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ "$self_src" != "$INSTALL_PATH" ]]; then
    cp "$self_src" "$INSTALL_PATH"
    sed -i 's/\r$//' "$INSTALL_PATH" 2>/dev/null || true
    chmod +x "$INSTALL_PATH"
  fi
}

seed_golden_backup() {
  local cfg="/etc/easypanel/traefik/config/main.yaml"
  local golden="/etc/easypanel/traefik/config/main.yaml.golden-traefik-all"
  [[ -f "$cfg" ]] || return 0
  if [[ ! -f "$golden" ]]; then
    cp -a "$cfg" "$golden"
    echo "Backup golden criado: ${golden}"
  fi
}

install_guard_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "AVISO: sem systemd — guarda inotify não instalada"
    return 0
  fi
  if ! command -v inotifywait >/dev/null 2>&1; then
    echo "Instalando inotify-tools..."
    apt-get update -qq && apt-get install -y -qq inotify-tools || echo "AVISO: instale inotify-tools manualmente"
  fi

  cat >"$GUARD_UNIT" <<EOF
[Unit]
Description=Traefik Easypanel — reaplica fix WABA+EVO quando main.yaml muda
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=${GUARD_SCRIPT} watch
Restart=always
RestartSec=5
Environment=TRAEFIK_ALL_SCRIPT=${INSTALL_PATH}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$GUARD_SERVICE"
  echo "Systemd: ${GUARD_SERVICE} ativo"
}

install_bootstrap_timer() {
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "AVISO: sem systemd — timer bootstrap não instalado"
    return 0
  fi

  cat >/etc/systemd/system/traefik-easypanel-bootstrap.service <<EOF
[Unit]
Description=Bootstrap Easypanel Traefik (porta 80 zumbi + force proxy)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=${BOOTSTRAP_SCRIPT} run
EOF

  cat >/etc/systemd/system/${BOOTSTRAP_TIMER} <<EOF
[Unit]
Description=Timer bootstrap Traefik Easypanel (a cada 2 min)

[Timer]
OnBootSec=90
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "$BOOTSTRAP_TIMER"
  echo "Systemd: ${BOOTSTRAP_TIMER} ativo (2 min)"
}

ensure_waba_host_port() {
  if curl -sf -m 4 "http://127.0.0.1:${WABA_HOST_PUBLISHED_PORT}/health" >/dev/null 2>&1; then
    return 0
  fi
  if ! docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$WABA_SWARM_SERVICE"; then
    echo "AVISO: serviço ${WABA_SWARM_SERVICE} ausente — skip publish ${WABA_HOST_PUBLISHED_PORT}" | tee -a "$LOG"
    return 1
  fi
  echo "AVISO: :${WABA_HOST_PUBLISHED_PORT} sem resposta — publicando ${WABA_SWARM_SERVICE}" | tee -a "$LOG"
  timeout 90 docker service update \
    --publish-add "published=${WABA_HOST_PUBLISHED_PORT},target=80,protocol=tcp" \
    "$WABA_SWARM_SERVICE" >>"$LOG" 2>&1 || true
  sleep 5
  curl -sf -m 4 "http://127.0.0.1:${WABA_HOST_PUBLISHED_PORT}/health" >/dev/null 2>&1
}

run_all() {
  echo "=== ${ALL_VERSION} run $(date -Is) ===" | tee -a "$LOG"

  if load_bootstrap; then
    traefik_bootstrap_ensure_traefik || true
  else
    echo "AVISO: ${BOOTSTRAP_SCRIPT} ausente — rode install" | tee -a "$LOG"
  fi
  ensure_waba_host_port || true

  local ok_waba=0 ok_evo=0 ok_pv=0 ok_bets=0

  if [[ -x "$RESTORE_WABA" ]]; then
    echo "--- restore WABA router ---" | tee -a "$LOG"
    "$RESTORE_WABA" >>"$LOG" 2>&1 && ok_waba=1 || true
  fi
  if [[ -x "$RESTORE_EVO" ]]; then
    echo "--- restore Evolution router ---" | tee -a "$LOG"
    "$RESTORE_EVO" >>"$LOG" 2>&1 && ok_evo=1 || true
  fi

  if [[ -x "$WABA_SCRIPT" ]]; then
    echo "--- traefik-permanent-waba ---" | tee -a "$LOG"
    "$WABA_SCRIPT" run | tee -a "$LOG" && ok_waba=1 || true
  fi
  if [[ -x "$EVO_SCRIPT" ]]; then
    echo "--- traefik-permanent-walkup-evo ---" | tee -a "$LOG"
    "$EVO_SCRIPT" run | tee -a "$LOG" && ok_evo=1 || true
  fi
  if [[ -x "$PV_SCRIPT" ]]; then
    echo "--- traefik-permanent-paginadevendas ---" | tee -a "$LOG"
    "$PV_SCRIPT" run | tee -a "$LOG" && ok_pv=1 || true
  fi
  if [[ -x "$BETS_SCRIPT" ]]; then
    echo "--- traefik-permanent-bets-pv ---" | tee -a "$LOG"
    "$BETS_SCRIPT" run | tee -a "$LOG" && ok_bets=1 || true
  fi

  echo "RESULTADO all: waba=${ok_waba} evo=${ok_evo} pv=${ok_pv} bets=${ok_bets}" | tee -a "$LOG"
  [[ "$ok_waba" -eq 1 || "$ok_evo" -eq 1 || "$ok_pv" -eq 1 || "$ok_bets" -eq 1 ]]
}

install_all() {
  install_scripts
  seed_golden_backup

  echo "--- instalando WABA permanent ---"
  "$WABA_SCRIPT" install || true

  echo "--- instalando Evolution permanent ---"
  "$EVO_SCRIPT" install || true

  echo "--- instalando paginadevendas permanent ---"
  "$PV_SCRIPT" install || true

  echo "--- instalando bets_pv permanent ---"
  "$BETS_SCRIPT" install || true

  install_bootstrap_timer
  install_guard_service
  run_all || true

  echo ""
  echo "=========================================="
  echo " Traefik DEFINITIVO instalado (${ALL_VERSION})"
  echo "=========================================="
  echo "  Master:     ${INSTALL_PATH}"
  echo "  Bootstrap:  ${BOOTSTRAP_SCRIPT} (+ timer ${BOOTSTRAP_TIMER})"
  echo "  WABA:       ${WABA_SCRIPT}"
  echo "  EVO:        ${EVO_SCRIPT}"
  echo "  PV:         ${PV_SCRIPT}"
  echo "  BETS:       ${BETS_SCRIPT}"
  echo "  Guard:      ${GUARD_SCRIPT} (${GUARD_SERVICE})"
  echo "  Log:        ${LOG}"
  echo ""
  echo "Comandos:"
  echo "  ${INSTALL_PATH} run"
  echo "  ${BOOTSTRAP_SCRIPT} run"
  echo "  ${BOOTSTRAP_SCRIPT} status"
  echo "  tail -f ${LOG}"
}

show_status() {
  echo "=== ${ALL_VERSION} status ==="
  for unit in \
    "$BOOTSTRAP_TIMER" \
    "$GUARD_SERVICE" \
    traefik-permanent-waba-watch.service \
    traefik-permanent-waba-fix.timer \
    traefik-permanent-walkup-evo-watch.service \
    traefik-permanent-walkup-evo-fix.timer \
    traefik-permanent-paginadevendas-watch.service \
    traefik-permanent-paginadevendas-fix.timer \
    traefik-permanent-bets-pv-watch.service \
    traefik-permanent-bets-pv-fix.timer; do
    if systemctl list-unit-files "$unit" &>/dev/null 2>&1; then
      printf "  %-45s %s\n" "$unit:" "$(systemctl is-active "$unit" 2>/dev/null || echo inactive)"
    fi
  done
  [[ -x "$BOOTSTRAP_SCRIPT" ]] && "$BOOTSTRAP_SCRIPT" status || echo "  Bootstrap ausente"
  [[ -x "$WABA_SCRIPT" ]] && "$WABA_SCRIPT" status || echo "  WABA script ausente"
  [[ -x "$EVO_SCRIPT" ]] && "$EVO_SCRIPT" status || echo "  EVO script ausente"
  [[ -x "$PV_SCRIPT" ]] && "$PV_SCRIPT" status || echo "  PV script ausente"
  [[ -x "$BETS_SCRIPT" ]] && "$BETS_SCRIPT" status || echo "  BETS script ausente"
}

case "${1:-run}" in
  install) install_all ;;
  run) run_all ;;
  status) show_status ;;
  *)
    echo "Uso: $0 install | run | status"
    exit 1
    ;;
esac
