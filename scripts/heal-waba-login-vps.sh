#!/bin/bash
# Heal login WABA (waba.draxsistemas.com.br) após redeploy Easypanel.
#
# Causa recorrente: serviço waba_waba_disparador perde publish host :30180
# e/ou Traefik aponta backend errado → HTTPS 502/404 → UI «Not Found» / login falha.
#
# Camadas (install ativa TODAS — nenhuma pode ficar morta):
#   1) watch       — docker events → bursts escalonados (0.3s / 8s / 25s / 60s / 120s)
#   2) timer       — a cada ~8s (rede de segurança)
#   3) supervisor  — a cada ~20s: se watch/timer inativos → reinstall; se HTTPS!=200 → burst
#   4) burst       — polling agressivo até HTTPS /health 200
#   5) Actions     — push master → SSH install + bursts
#
# Uso (root):
#   bash heal-waba-login-vps.sh run|burst|watch|ensure|install|status|check
#
# Versão: heal-waba-login-2026-07-22-v6-supervisor-anti-502
set -euo pipefail

VERSION="heal-waba-login-2026-07-22-v6-supervisor-anti-502"
LOG="${WABA_LOGIN_HEAL_LOG:-/var/log/waba-login-heal.log}"
LOCK="${WABA_LOGIN_HEAL_LOCK:-/var/run/waba-login-heal.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-login-heal.service"
TIMER="waba-login-heal.timer"
WATCH_SERVICE="waba-login-heal-watch.service"
SUPERVISOR_SERVICE="waba-login-heal-supervisor.service"
SUPERVISOR_TIMER="waba-login-heal-supervisor.timer"
SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_waba_disparador}"
HOST_PORT="${WABA_HOST_PUBLISHED_PORT:-30180}"
DOMAIN="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
TIMER_SEC="${WABA_LOGIN_HEAL_SEC:-8}"
SUPERVISOR_SEC="${WABA_LOGIN_HEAL_SUPERVISOR_SEC:-20}"
BURST_ROUNDS="${WABA_LOGIN_HEAL_BURST_ROUNDS:-50}"
BURST_SLEEP="${WABA_LOGIN_HEAL_BURST_SLEEP:-2}"
LOCK_WAIT_SEC="${WABA_LOGIN_HEAL_LOCK_WAIT:-120}"

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

unit_active() {
  systemctl is-active --quiet "$1" 2>/dev/null
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
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 2
    if local_health_ok; then
      log "OK local :${HOST_PORT}/health após publish (tentativa ${i})"
      return 0
    fi
    log "aguardando :${HOST_PORT}/health (${i}/15)..."
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
    # Espera (não skip) — durante redeploy vários bursts devem enfileirar.
    if ! flock -w "$LOCK_WAIT_SEC" 9; then
      log "lock timeout ${LOCK_WAIT_SEC}s — skip"
      return 1
    fi
  fi
  return 0
}

schedule_staggered_bursts() {
  local reason="${1:-event}"
  local self
  self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  log "agendando bursts escalonados (${reason})"
  # Easypanel costuma remover o publish DEPOIS do 1º heal — relançar várias vezes.
  ( sleep 0.3; bash "$self" burst ) >>"$LOG" 2>&1 &
  ( sleep 8; bash "$self" burst ) >>"$LOG" 2>&1 &
  ( sleep 25; bash "$self" burst ) >>"$LOG" 2>&1 &
  ( sleep 60; bash "$self" burst ) >>"$LOG" 2>&1 &
  ( sleep 120; bash "$self" burst ) >>"$LOG" 2>&1 &
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

cmd_watch() {
  mkdir -p "$(dirname "$LOG")"
  log "watch ativo — eventos docker service=${SWARM_SERVICE} (bursts escalonados)"
  docker events \
    --filter "type=service" \
    --filter "type=container" \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r etype eaction ename esvc; do
      case "$etype" in
        service)
          if [[ "$ename" == "$SWARM_SERVICE" ]] || [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              update|create|remove|scale)
                log "evento service ${eaction} ${ename}"
                schedule_staggered_bursts "service-${eaction}"
                ;;
            esac
          fi
          ;;
        container)
          if [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              start|die|kill|stop)
                log "evento container ${eaction} svc=${esvc}"
                schedule_staggered_bursts "container-${eaction}"
                ;;
            esac
          fi
          ;;
      esac
    done
}

# Camada à prova de falha: revive unidades mortas + cura 502 sem depender de evento.
cmd_ensure() {
  mkdir -p "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/heal-waba-login-vps.sh"
  local need_reinstall=0

  if ! unit_active "$WATCH_SERVICE"; then
    log "ENSURE: ${WATCH_SERVICE} inativo — reativando"
    need_reinstall=1
  fi
  if ! unit_active "$TIMER"; then
    log "ENSURE: ${TIMER} inativo — reativando"
    need_reinstall=1
  fi
  if ! unit_active "$SUPERVISOR_TIMER"; then
    log "ENSURE: ${SUPERVISOR_TIMER} inativo — reativando"
    need_reinstall=1
  fi

  if [[ "$need_reinstall" -eq 1 ]]; then
    if [[ -x "$dest" ]]; then
      bash "$dest" install >>"$LOG" 2>&1 || true
    else
      systemctl enable --now "$WATCH_SERVICE" 2>/dev/null || true
      systemctl enable --now "$TIMER" 2>/dev/null || true
      systemctl enable --now "$SUPERVISOR_TIMER" 2>/dev/null || true
    fi
  fi

  if ! cmd_check; then
    log "ENSURE: path degradado — burst"
    bash "${BASH_SOURCE[0]}" burst || bash "${BASH_SOURCE[0]}" run || true
  fi
  return 0
}

install_units() {
  local dest="${INSTALL_DIR}/heal-waba-login-vps.sh"

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=WABA login heal (:30180 publish + backends pós-redeploy)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA login heal a cada ${TIMER_SEC}s (rede de segurança pós-redeploy)

[Timer]
OnBootSec=15s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=2s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  cat >"${UNIT_DIR}/${WATCH_SERVICE}" <<EOF
[Unit]
Description=WABA login heal WATCH — docker events → bursts escalonados no redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=2
ExecStart=${dest} watch

[Install]
WantedBy=multi-user.target
EOF

  cat >"${UNIT_DIR}/${SUPERVISOR_SERVICE}" <<EOF
[Unit]
Description=WABA login heal SUPERVISOR — revive watch/timer + cura 502
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} ensure
EOF

  cat >"${UNIT_DIR}/${SUPERVISOR_TIMER}" <<EOF
[Unit]
Description=WABA login heal SUPERVISOR a cada ${SUPERVISOR_SEC}s (anti-queda permanente)

[Timer]
OnBootSec=30s
OnUnitActiveSec=${SUPERVISOR_SEC}s
AccuracySec=3s
Persistent=true

[Install]
WantedBy=timers.target
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
  systemctl enable --now "$SUPERVISOR_TIMER"
  log "instalado ${TIMER} (${TIMER_SEC}s) + ${WATCH_SERVICE} + ${SUPERVISOR_TIMER} (${SUPERVISOR_SEC}s)"
  bash "$dest" burst || bash "$dest" run || true

  local ok=1
  unit_active "$WATCH_SERVICE" && log "OK ${WATCH_SERVICE}=active" || { log "ERRO ${WATCH_SERVICE}!=active"; ok=0; }
  unit_active "$TIMER" && log "OK ${TIMER}=active" || { log "ERRO ${TIMER}!=active"; ok=0; }
  unit_active "$SUPERVISOR_TIMER" && log "OK ${SUPERVISOR_TIMER}=active" || { log "ERRO ${SUPERVISOR_TIMER}!=active"; ok=0; }
  [[ "$ok" -eq 1 ]] || exit 1
  systemctl status "$WATCH_SERVICE" --no-pager -l | head -n 12 || true
  systemctl status "$SUPERVISOR_TIMER" --no-pager -l | head -n 8 || true
}

cmd_status() {
  echo "version=${VERSION}"
  for u in "$WATCH_SERVICE" "$TIMER" "$SUPERVISOR_TIMER"; do
    echo -n "${u}: "
    systemctl is-active "$u" 2>/dev/null || echo "inactive"
  done
  echo "--- watch ---"
  systemctl status "$WATCH_SERVICE" --no-pager 2>/dev/null | head -n 12 || echo "(watch não instalado)"
  echo "--- supervisor ---"
  systemctl status "$SUPERVISOR_TIMER" --no-pager 2>/dev/null | head -n 8 || echo "(supervisor não instalado)"
  echo "--- last log ---"
  tail -40 "$LOG" 2>/dev/null || echo "(sem log)"
  echo "--- probe ---"
  curl -sS --max-time 6 "http://172.17.0.1:${HOST_PORT}/health" | head -c 200 || echo "local:DOWN"
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
  ensure) cmd_ensure ;;
  install) cmd_install ;;
  status) cmd_status ;;
  check) cmd_check ;;
  *)
    echo "Uso: $0 run|burst|watch|ensure|install|status|check"
    exit 1
    ;;
esac
