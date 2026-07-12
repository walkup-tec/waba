#!/bin/bash
# Heal login WABA (waba.draxsistemas.com.br) após redeploy Easypanel.
#
# Causa recorrente: serviço waba_waba_disparador perde publish host :30180
# e/ou Traefik aponta backend errado → HTTPS 502 → UI «Não foi possível entrar.»
#
# Este watchdog (timer ~60s):
#   1) Se :30180/health falhar → republica published=30180,target=80,mode=host
#   2) Garante backend Traefik http://172.17.0.1:30180/ (sem HUP)
#   3) Valida HTTPS /health do domínio WABA
#
# Uso (root):
#   bash heal-waba-login-vps.sh run|install|status|check
#
# Versão: heal-waba-login-2026-07-11-v1
set -euo pipefail

VERSION="heal-waba-login-2026-07-11-v1"
LOG="${WABA_LOGIN_HEAL_LOG:-/var/log/waba-login-heal.log}"
LOCK="${WABA_LOGIN_HEAL_LOCK:-/var/run/waba-login-heal.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-login-heal.service"
TIMER="waba-login-heal.timer"
SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
HOST_PORT="${WABA_HOST_PUBLISHED_PORT:-30180}"
DOMAIN="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
RESTORE_BACKENDS="${RESTORE_BACKENDS_SCRIPT:-/root/restore-easypanel-traefik-backends-vps.sh}"
TIMER_SEC="${WABA_LOGIN_HEAL_SEC:-60}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

local_health_ok() {
  local code body
  body="$(curl -sS --max-time 6 -w '\n%{http_code}' "http://127.0.0.1:${HOST_PORT}/health" 2>/dev/null || true)"
  code="$(printf '%s' "$body" | tail -n1)"
  [[ "$code" == "200" ]]
}

https_health_ok() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
    --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}/health" 2>/dev/null || true)"
  [[ -n "$code" ]] || code="000"
  [[ "$code" == "200" ]]
}

service_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SWARM_SERVICE"
}

ensure_host_publish() {
  if ! service_exists; then
    log "ERRO: serviço ${SWARM_SERVICE} ausente"
    return 1
  fi
  log "Republicando ${SWARM_SERVICE} :${HOST_PORT}->80 mode=host"
  # Remove publish legado (ingress ou host) se existir; ignore erro.
  docker service update --publish-rm "${HOST_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  # Alguns Swarm guardam target=80 sem published explícito na remoção — tenta pair completo.
  docker service update --publish-rm "${HOST_PORT}:80" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  timeout 120 docker service update \
    --publish-add "published=${HOST_PORT},target=80,protocol=tcp,mode=host" \
    "$SWARM_SERVICE" >>"$LOG" 2>&1 || {
      log "ERRO: docker service update publish falhou"
      return 1
    }
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 3
    if local_health_ok; then
      log "OK local :${HOST_PORT}/health após publish (tentativa ${i})"
      return 0
    fi
    log "aguardando :${HOST_PORT}/health (${i}/10)..."
  done
  log "ERRO: :${HOST_PORT}/health ainda down após publish"
  return 1
}

ensure_restore_script() {
  if [[ -x "$RESTORE_BACKENDS" ]]; then
    return 0
  fi
  log "Baixando restore-easypanel-traefik-backends-vps.sh"
  curl -fsSL "${REPO_SCRIPTS}/restore-easypanel-traefik-backends-vps.sh" -o "$RESTORE_BACKENDS" || return 1
  sed -i 's/\r$//' "$RESTORE_BACKENDS" 2>/dev/null || true
  chmod +x "$RESTORE_BACKENDS"
}

restore_backends() {
  ensure_restore_script || { log "AVISO: script backends ausente"; return 1; }
  log "Restaurando backends Traefik (host gateway; sem HUP)"
  bash "$RESTORE_BACKENDS" >>"$LOG" 2>&1 || {
    log "AVISO: restore backends retornou erro"
    return 1
  }
  return 0
}

cmd_check() {
  if local_health_ok && https_health_ok; then
    log "check OK — local:${HOST_PORT} + https://${DOMAIN}/health"
    return 0
  fi
  log "check FALHA — local=$(local_health_ok && echo ok || echo down) https=$(https_health_ok && echo ok || echo down)"
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro heal-login em execução — skip"; return 0; }
  fi

  if cmd_check; then
    return 0
  fi

  log "Login path degradado — iniciando heal"

  if ! local_health_ok; then
    ensure_host_publish || true
  fi

  if local_health_ok; then
    restore_backends || true
    sleep 3
  else
    log "ERRO: app local ainda down — backends não corrigem HTTPS sozinho"
    return 1
  fi

  if https_health_ok; then
    log "recuperado — HTTPS /health 200"
    return 0
  fi

  # Segunda passagem backends (Easypanel pode reescrever yaml no deploy)
  restore_backends || true
  sleep 5
  if https_health_ok; then
    log "recuperado na 2ª passagem backends"
    return 0
  fi

  log "ERRO: HTTPS ainda != 200 após heal"
  return 1
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/heal-waba-login-vps.sh"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ -f "$src" ]]; then
    cp "$src" "$dest"
  else
    curl -fsSL "${REPO_SCRIPTS}/heal-waba-login-vps.sh" -o "$dest"
  fi
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"

  # Também em /root para colar manual / permanent-all
  cp "$dest" /root/heal-waba-login-vps.sh
  chmod +x /root/heal-waba-login-vps.sh

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=WABA login heal (:30180 publish + Traefik backends pós-redeploy)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA login heal a cada ${TIMER_SEC}s (evita 502 pós-redeploy Easypanel)

[Timer]
OnBootSec=40s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=5s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  log "instalado ${TIMER} (${TIMER_SEC}s)"
  bash "$dest" run || true
  systemctl status "$TIMER" --no-pager || true
}

cmd_status() {
  systemctl status "$TIMER" --no-pager 2>/dev/null || echo "(timer não instalado)"
  echo "--- last log ---"
  tail -25 "$LOG" 2>/dev/null || echo "(sem log)"
  echo "--- probe ---"
  curl -sS --max-time 6 "http://127.0.0.1:${HOST_PORT}/health" | head -c 200 || echo "local:DOWN"
  echo
  curl -sS -o /dev/null -w "https:%{http_code}\n" --max-time 12 \
    --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/health" || echo "https:000"
}

case "${1:-}" in
  run) cmd_run ;;
  install) cmd_install ;;
  status) cmd_status ;;
  check) cmd_check ;;
  *)
    echo "Uso: $0 run|install|status|check"
    exit 1
    ;;
esac
