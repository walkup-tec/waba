#!/bin/bash
# Heal login WABA (waba.draxsistemas.com.br) após redeploy Easypanel.
#
# Causa recorrente: serviço waba_waba_disparador perde publish host :30180
# e/ou Traefik aponta backend errado → HTTPS 502/404 → UI «Not Found» / login falha.
#
# Camadas (install ativa as três):
#   1) watch  — docker events: no update/start do serviço → heal imediato + burst
#   2) timer  — a cada ~10s (rede de segurança)
#   3) burst  — polling agressivo (~2s) até HTTPS /health 200
#
# Uso (root):
#   bash heal-waba-login-vps.sh run|burst|watch|install|status|check
#
# Versão: heal-waba-login-2026-07-21-v4-fast-hairpin
set -euo pipefail

VERSION="heal-waba-login-2026-07-21-v4-fast-hairpin"
LOG="${WABA_LOGIN_HEAL_LOG:-/var/log/waba-login-heal.log}"
LOCK="${WABA_LOGIN_HEAL_LOCK:-/var/run/waba-login-heal.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-login-heal.service"
TIMER="waba-login-heal.timer"
WATCH_SERVICE="waba-login-heal-watch.service"
SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
HOST_PORT="${WABA_HOST_PUBLISHED_PORT:-30180}"
DOMAIN="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
TIMER_SEC="${WABA_LOGIN_HEAL_SEC:-10}"
BURST_ROUNDS="${WABA_LOGIN_HEAL_BURST_ROUNDS:-40}"
BURST_SLEEP="${WABA_LOGIN_HEAL_BURST_SLEEP:-2}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

# Neste VPS, 127.0.0.1:publish às vezes falha (hairpin); 172.17.0.1 é o probe canônico.
local_health_ok() {
  local code
  for url in \
    "http://172.17.0.1:${HOST_PORT}/health" \
    "http://127.0.0.1:${HOST_PORT}/health"; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || true)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
  done
  return 1
}

https_health_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
    --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}/health" 2>/dev/null || echo "000"
}

https_health_ok() {
  local code
  code="$(https_health_code)"
  [[ "$code" == "200" ]]
}

service_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SWARM_SERVICE"
}

publish_present() {
  docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -q "\"PublishedPort\":${HOST_PORT}" \
    || docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
      | grep -q "\"PublishedPort\": ${HOST_PORT}"
}

ensure_host_publish() {
  if ! service_exists; then
    log "ERRO: serviço ${SWARM_SERVICE} ausente"
    return 1
  fi
  if publish_present && local_health_ok; then
    log "publish :${HOST_PORT} já presente e local OK"
    return 0
  fi
  log "Republicando ${SWARM_SERVICE} :${HOST_PORT}->80 mode=host"
  docker service update --publish-rm "${HOST_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  docker service update --publish-rm "${HOST_PORT}:80" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  timeout 120 docker service update \
    --publish-add "published=${HOST_PORT},target=80,protocol=tcp,mode=host" \
    "$SWARM_SERVICE" >>"$LOG" 2>&1 || {
      log "ERRO: docker service update publish falhou"
      return 1
    }
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 2
    if local_health_ok; then
      log "OK local :${HOST_PORT}/health após publish (tentativa ${i})"
      return 0
    fi
    log "aguardando :${HOST_PORT}/health (${i}/12)..."
  done
  log "ERRO: :${HOST_PORT}/health ainda down após publish"
  return 1
}

# O heal da aplicação é publish-only. Toda escrita Traefik pertence ao Guardião.
request_guardian_repair() {
  local guardian="/root/waba-infra/guardiao-sistemas-traefik-vps.sh"
  if [[ -x "$guardian" ]]; then
    log "solicitando reparo transacional ao Guardião"
    bash "$guardian" repair >>"$LOG" 2>&1 || true
  else
    log "AVISO: Guardião ausente — não editando main.yaml"
  fi
}

with_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro heal-login em execução — skip"; return 1; }
  fi
  return 0
}

cmd_check() {
  if local_health_ok && https_health_ok; then
    log "check OK — local:${HOST_PORT} + https://${DOMAIN}/health"
    return 0
  fi
  log "check FALHA — local=$(local_health_ok && echo ok || echo down) https=$(https_health_code)"
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0

  if cmd_check; then
    # Proativo: se publish sumiu mas algo ainda responde, reafirma (raro).
    if service_exists && ! publish_present; then
      log "HTTPS OK mas publish :${HOST_PORT} ausente — reafirmando"
      ensure_host_publish || true
    fi
    return 0
  fi

  log "Login path degradado — iniciando heal"

  if ! local_health_ok || ! publish_present; then
    ensure_host_publish || true
  fi

  if local_health_ok; then
    request_guardian_repair
    sleep 2
  else
    log "ERRO: app local ainda down — backends não corrigem HTTPS sozinho"
    return 1
  fi

  if https_health_ok; then
    log "recuperado — HTTPS /health 200"
    return 0
  fi

  request_guardian_repair
  sleep 3
  if https_health_ok; then
    log "recuperado na 2ª passagem backends"
    return 0
  fi

  log "ERRO: HTTPS ainda != 200 após heal (code=$(https_health_code))"
  return 1
}

# Polling agressivo — usar logo após redeploy / evento docker
cmd_burst() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0
  local i code
  log "burst início — até ${BURST_ROUNDS}x a cada ${BURST_SLEEP}s"
  for i in $(seq 1 "$BURST_ROUNDS"); do
    if local_health_ok && https_health_ok; then
      log "burst OK na rodada ${i} — HTTPS 200"
      return 0
    fi
    log "burst ${i}/${BURST_ROUNDS} local=$(local_health_ok && echo ok || echo down) https=$(https_health_code)"
    if ! local_health_ok || ! publish_present; then
      ensure_host_publish || true
    fi
    if local_health_ok; then
      request_guardian_repair
    fi
    sleep "$BURST_SLEEP"
  done
  code="$(https_health_code)"
  if [[ "$code" == "200" ]]; then
    log "burst OK no fim"
    return 0
  fi
  log "burst FALHOU — https=${code}"
  return 1
}

# Escuta Swarm/container: reage no segundo em que o Easypanel redeploya
cmd_watch() {
  mkdir -p "$(dirname "$LOG")"
  log "watch ativo — eventos docker service=${SWARM_SERVICE}"
  # shellcheck disable=SC2034
  docker events \
    --filter "type=service" \
    --filter "type=container" \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r etype eaction ename esvc; do
      case "$etype" in
        service)
          if [[ "$ename" == "$SWARM_SERVICE" ]] || [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              update|create|remove)
                log "evento service ${eaction} ${ename} — burst imediato"
                ( sleep 1; bash "$0" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
        container)
          if [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              start|die|kill)
                log "evento container ${eaction} svc=${esvc} — burst imediato"
                ( sleep 1; bash "$0" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
      esac
    done
}

install_units() {
  local dest="${INSTALL_DIR}/heal-waba-login-vps.sh"

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
Description=WABA login heal a cada ${TIMER_SEC}s (rede de segurança pós-redeploy)

[Timer]
OnBootSec=25s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=3s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  cat >"${UNIT_DIR}/${WATCH_SERVICE}" <<EOF
[Unit]
Description=WABA login heal WATCH — docker events → burst imediato no redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=${dest} watch

[Install]
WantedBy=multi-user.target
EOF
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
  cp "$dest" /root/heal-waba-login-vps.sh
  chmod +x /root/heal-waba-login-vps.sh

  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  systemctl enable --now "$WATCH_SERVICE"
  log "instalado ${TIMER} (${TIMER_SEC}s) + ${WATCH_SERVICE}"
  bash "$dest" burst || bash "$dest" run || true
  systemctl status "$TIMER" --no-pager || true
  systemctl status "$WATCH_SERVICE" --no-pager || true
}

cmd_status() {
  systemctl status "$TIMER" --no-pager 2>/dev/null || echo "(timer não instalado)"
  echo "--- watch ---"
  systemctl status "$WATCH_SERVICE" --no-pager 2>/dev/null || echo "(watch não instalado)"
  echo "--- last log ---"
  tail -30 "$LOG" 2>/dev/null || echo "(sem log)"
  echo "--- probe ---"
  curl -sS --max-time 6 "http://127.0.0.1:${HOST_PORT}/health" | head -c 200 || echo "local:DOWN"
  echo
  curl -sS -o /dev/null -w "https:%{http_code}\n" --max-time 12 \
    --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/health" || echo "https:000"
  if service_exists; then
    echo "--- publish ---"
    docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null | head -c 400 || true
    echo
  fi
}

case "${1:-}" in
  run) cmd_run ;;
  burst) cmd_burst ;;
  watch) cmd_watch ;;
  install) cmd_install ;;
  status) cmd_status ;;
  check) cmd_check ;;
  *)
    echo "Uso: $0 run|burst|watch|install|status|check"
    exit 1
    ;;
esac
