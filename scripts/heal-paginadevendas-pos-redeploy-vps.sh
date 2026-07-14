#!/bin/bash
# Heal permanente wabadisparos / waba_paginadevendas — NÃO pode ficar 502 pós-redeploy.
#
# Sintoma: browser 502 ou JSON Easypanel {"Cannot GET /api/errors/bad-gateway"}
# Causa: Easypanel Redeploy remove publish :30210 e/ou Traefik aponta overlay.
#
# Camadas (install ativa as três):
#   1) watch  — docker events no serviço → burst imediato
#   2) timer  — a cada ~20s (rede de segurança)
#   3) burst  — polling até HTTPS 200 + /api/health
#
# Uso (root, UMA VEZ):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/heal-paginadevendas-pos-redeploy-vps.sh" \
#     -o /tmp/heal-paginadevendas-pos-redeploy-vps.sh
#   sed -i 's/\r$//' /tmp/heal-paginadevendas-pos-redeploy-vps.sh
#   chmod +x /tmp/heal-paginadevendas-pos-redeploy-vps.sh
#   /tmp/heal-paginadevendas-pos-redeploy-vps.sh install
#
# Depois: run|burst|watch|status|check
#
# NÃO: docker service update --force easypanel-traefik | kill docker-proxy
# Versão: heal-paginadevendas-pos-redeploy-2026-07-14-v2
set -euo pipefail

VERSION="heal-paginadevendas-pos-redeploy-2026-07-14-v2"
LOG="${WABA_PV_HEAL_LOG:-/var/log/heal-paginadevendas-pos-redeploy.log}"
LOCK="${WABA_PV_HEAL_LOCK:-/var/run/heal-paginadevendas-pos-redeploy.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE_UNIT="waba-paginadevendas-heal.service"
TIMER="waba-paginadevendas-heal.timer"
WATCH_SERVICE="waba-paginadevendas-heal-watch.service"
SWARM_SERVICE="${WABA_SWARM_SERVICE:-waba_paginadevendas}"
HOST_PORT="${WABA_PV_PUBLISHED_PORT:-30210}"
TARGET_PORT="${WABA_PORT:-3000}"
DOMAIN="${WABA_PUBLIC_HOST:-wabadisparos.com.br}"
EP_HOST="${WABA_EASYPANEL_HOST:-waba-paginadevendas.achpyp.easypanel.host}"
CFG="${WABA_TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
REPO_SCRIPTS="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
TIMER_SEC="${WABA_PV_HEAL_SEC:-20}"
BURST_ROUNDS="${WABA_PV_HEAL_BURST_ROUNDS:-30}"
BURST_SLEEP="${WABA_PV_HEAL_BURST_SLEEP:-5}"
SELF="${INSTALL_DIR}/heal-paginadevendas-pos-redeploy-vps.sh"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

local_ok() {
  local c
  c="$(http_code "http://127.0.0.1:${HOST_PORT}/")"
  [[ "$c" == "200" || "$c" == "301" || "$c" == "302" || "$c" == "304" ]]
}

https_code() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 14 \
    --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}/" 2>/dev/null || echo "000"
}

https_ok() {
  local c
  c="$(https_code)"
  [[ "$c" == "200" || "$c" == "301" || "$c" == "302" || "$c" == "304" ]]
}

health_ok() {
  local c
  c="$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health")"
  [[ "$c" == "200" ]]
}

service_exists() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$SWARM_SERVICE"
}

publish_present() {
  local ports
  ports="$(docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo "[]")"
  echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}\|\"PublishedPort\": ${HOST_PORT}"
}

with_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro heal-pv em execução — skip"; return 1; }
  fi
  return 0
}

ensure_host_publish() {
  if ! service_exists; then
    log "ERRO: serviço ${SWARM_SERVICE} ausente"
    return 1
  fi
  if publish_present && local_ok; then
    log "publish :${HOST_PORT} OK + local 200"
    return 0
  fi
  log "Republicando ${SWARM_SERVICE} :${HOST_PORT}->${TARGET_PORT} mode=host"
  docker service update --publish-rm "${HOST_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  docker service update --publish-rm "${HOST_PORT}:${TARGET_PORT}" "$SWARM_SERVICE" >>"$LOG" 2>&1 || true
  timeout 120 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$SWARM_SERVICE" >>"$LOG" 2>&1 || {
      log "ERRO: publish update falhou"
      return 1
    }
  local i
  for i in $(seq 1 18); do
    sleep 2
    if local_ok; then
      log "OK local :${HOST_PORT}/ após publish (tentativa ${i})"
      return 0
    fi
    log "aguardando local :${HOST_PORT} (${i}/18)..."
  done
  log "ERRO: local ainda down — logs:"
  docker service logs "$SWARM_SERVICE" --tail 40 2>&1 | tee -a "$LOG" || true
  return 1
}

# Patch cirúrgico só paginadevendas → 172.17.0.1:30210 (+ HUP)
patch_pv_backends() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 1; }
  local bak
  bak="${CFG}.bak-heal-pv-$(date +%s)"
  cp -a "$CFG" "$bak"
  python3 - "$CFG" "$HOST_PORT" <<'PY' || return 1
import re, sys
from pathlib import Path
path, port = Path(sys.argv[1]), sys.argv[2]
url = f"http://172.17.0.1:{port}/"
text = path.read_text(encoding="utf-8")
nfix = 0

def extract_block(text, start):
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return text[start:end], start, end

svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}', re.M)
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    kl = key.lower()
    if "paginadevendas" not in kl and "pagina-devendas" not in kl:
        pos = bend
        continue
    nb = re.sub(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
    if "passHostHeader" not in nb:
        nb = nb.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": true,', 1)
    else:
        nb = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": true', nb, count=1)
    if nb != block:
        text = text[:bstart] + nb + text[bend:]
        pos = bstart + len(nb)
        nfix += 1
        print(f"service {key} -> {url}")
    else:
        pos = bend

path.write_text(text, encoding="utf-8")
print(f"patched={nfix}")
PY
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  if [[ -z "$cid" ]]; then
    log "AVISO: Traefik container não encontrado — patch yaml feito"
    return 1
  fi
  docker kill -s HUP "$cid" >/dev/null 2>&1 || true
  log "HUP Traefik ${cid:0:12} (backends PV)"
  sleep 6
  return 0
}

run_fix_landings_both() {
  local fix="/tmp/fix-landings-both-heal-pv.sh"
  curl -fsSL "${REPO_SCRIPTS}/fix-landings-both-vps.sh" -o "$fix" >>"$LOG" 2>&1 || return 1
  sed -i 's/\r$//' "$fix" 2>/dev/null || true
  chmod +x "$fix"
  timeout 90 bash "$fix" >>"$LOG" 2>&1 || {
    log "AVISO: fix-landings-both exit=$?"
    return 1
  }
  return 0
}

cmd_check() {
  if local_ok && https_ok; then
    log "check OK — local:${HOST_PORT} + https://${DOMAIN}/"
    return 0
  fi
  log "check FALHA — local=$(local_ok && echo ok || echo down) https=$(https_code)"
  return 1
}

heal_once() {
  if ! local_ok || ! publish_present; then
    ensure_host_publish || true
  fi
  if ! local_ok; then
    log "ERRO: app local down — Traefik sozinho não resolve"
    return 1
  fi
  patch_pv_backends || true
  sleep 2
  if https_ok; then
    return 0
  fi
  run_fix_landings_both || true
  sleep 3
  https_ok
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

  log "Landing degradada — heal"
  heal_once || true
  if https_ok; then
    log "recuperado — HTTPS ${DOMAIN} $(https_code)"
    return 0
  fi
  log "ERRO: HTTPS ainda $(https_code) após heal"
  return 1
}

cmd_burst() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0
  local i
  log "burst início — até ${BURST_ROUNDS}x / ${BURST_SLEEP}s"
  for i in $(seq 1 "$BURST_ROUNDS"); do
    if local_ok && https_ok; then
      log "burst OK rodada ${i} — https=$(https_code) health=$(health_ok && echo ok || echo fail)"
      return 0
    fi
    log "burst ${i}/${BURST_ROUNDS} local=$(local_ok && echo ok || echo down) https=$(https_code)"
    if ! local_ok || ! publish_present; then
      ensure_host_publish || true
    fi
    if local_ok; then
      if [[ "$i" -le 4 ]] || [[ "$((i % 3))" -eq 0 ]]; then
        patch_pv_backends || true
      fi
      if [[ "$i" -ge 6 ]] && ! https_ok; then
        run_fix_landings_both || true
      fi
    fi
    sleep "$BURST_SLEEP"
  done
  if https_ok; then
    log "burst OK no fim"
    return 0
  fi
  log "burst FALHOU — https=$(https_code)"
  return 1
}

cmd_watch() {
  mkdir -p "$(dirname "$LOG")"
  log "watch ativo — eventos docker service=${SWARM_SERVICE}"
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
                log "evento service ${eaction} ${ename} — burst"
                ( sleep 3; bash "$SELF" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
        container)
          if [[ "$esvc" == "$SWARM_SERVICE" ]]; then
            case "$eaction" in
              start|die|kill)
                log "evento container ${eaction} — burst"
                ( sleep 4; bash "$SELF" burst ) >>"$LOG" 2>&1 &
                ;;
            esac
          fi
          ;;
      esac
    done
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE_UNIT}" <<EOF
[Unit]
Description=WABA paginadevendas heal (:30210 + Traefik backends pós-redeploy)
After=docker.service

[Service]
Type=oneshot
ExecStart=${SELF} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA paginadevendas heal a cada ${TIMER_SEC}s (anti 502 pós-redeploy)

[Timer]
OnBootSec=30s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=3s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  cat >"${UNIT_DIR}/${WATCH_SERVICE}" <<EOF
[Unit]
Description=WABA paginadevendas heal WATCH — docker events → burst no redeploy
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=${SELF} watch

[Install]
WantedBy=multi-user.target
EOF
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ -f "$src" ]]; then
    cp "$src" "$SELF"
  else
    curl -fsSL "${REPO_SCRIPTS}/heal-paginadevendas-pos-redeploy-vps.sh" -o "$SELF"
  fi
  sed -i 's/\r$//' "$SELF" 2>/dev/null || true
  chmod +x "$SELF"
  cp "$SELF" /root/heal-paginadevendas-pos-redeploy-vps.sh
  chmod +x /root/heal-paginadevendas-pos-redeploy-vps.sh

  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  systemctl enable --now "$WATCH_SERVICE"
  log "instalado ${TIMER} (${TIMER_SEC}s) + ${WATCH_SERVICE}"
  bash "$SELF" burst || bash "$SELF" run || true
  systemctl status "$TIMER" --no-pager || true
  systemctl status "$WATCH_SERVICE" --no-pager || true
  echo
  echo "Validar: systemctl is-active ${WATCH_SERVICE}  → active"
  echo "         curl -sS -o /dev/null -w '%{http_code}\\n' https://${DOMAIN}/"
}

cmd_status() {
  systemctl status "$TIMER" --no-pager 2>/dev/null || echo "(timer não instalado)"
  echo "--- watch ---"
  systemctl status "$WATCH_SERVICE" --no-pager 2>/dev/null || echo "(watch não instalado)"
  echo "--- last log ---"
  tail -40 "$LOG" 2>/dev/null || echo "(sem log)"
  echo "--- probe ---"
  echo -n "local: "; http_code "http://127.0.0.1:${HOST_PORT}/"; echo
  echo -n "https: "; https_code; echo
  echo -n "health: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health"; echo
  echo -n "easypanel-host: "; http_code "https://${EP_HOST}/"; echo
  if service_exists; then
    echo "--- publish ---"
    docker service inspect "$SWARM_SERVICE" --format '{{json .Endpoint.Ports}}' 2>/dev/null | head -c 500 || true
    echo
    docker service ls --filter "name=${SWARM_SERVICE}" --format '{{.Name}} {{.Replicas}}'
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
