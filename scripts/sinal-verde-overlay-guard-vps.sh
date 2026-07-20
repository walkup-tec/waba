#!/bin/bash
# Guard permanente Sinal Verde — anti 502 pós-Redeploy Easypanel.
#
# Causa: Redeploy reescreve Traefik para overlay
#   http://sinal-verde_acesso-sinalverde:3000/  → 502 neste VPS
# Correção segura: só troca URL → http://172.17.0.1:30310/
#   + garante publish host :30310 no CRM
#
# NUNCA: inject de blocos no main.yaml | force Traefik | HUP
# Aborta se wabadisparos sumir do yaml (proteção WABA).
#
# Uso (root, UMA VEZ):
#   curl -fsSL ".../sinal-verde-overlay-guard-vps.sh" -o /tmp/sv-guard.sh
#   sed -i 's/\r$//' /tmp/sv-guard.sh && bash /tmp/sv-guard.sh install
#
# Depois: run|status|install|uninstall
#
# Doc: https://doc.traefik.io/traefik/getting-started/configuration-overview/
# Versão: sinal-verde-overlay-guard-2026-07-20-v1
set -euo pipefail

VERSION="sinal-verde-overlay-guard-2026-07-20-v1"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${SV_GUARD_LOG:-/var/log/sinal-verde-overlay-guard.log}"
LOCK="/var/run/sinal-verde-overlay-guard.lock"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/sinal-verde-overlay-guard-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="sinal-verde-overlay-guard.timer"
SERVICE="sinal-verde-overlay-guard.service"
WATCH="sinal-verde-overlay-guard-watch.service"
CRM="${SV_SWARM_SERVICE:-sinal-verde_acesso-sinalverde}"
HOST_PORT="${SV_PUBLISHED_PORT:-30310}"
TARGET_PORT="${SV_PORT:-3000}"
DOMAIN="${SV_PUBLIC_HOST:-acesso-sinalverde.com}"
GW="${WABA_HOST_GW:-172.17.0.1}"
URL="http://${GW}:${HOST_PORT}/"
TIMER_SEC="${SV_GUARD_SEC:-20}"
REPO="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null || echo 000; }

with_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -w 25 9 || return 1
  fi
  return 0
}

crm_publish_ok() {
  docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -q "\"PublishedPort\":${HOST_PORT}\|\"PublishedPort\": ${HOST_PORT}"
}

ensure_publish() {
  docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$CRM" || return 1
  crm_publish_ok && return 0
  log "republicando CRM :${HOST_PORT}->${TARGET_PORT}"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || return 1
  sleep 4
  crm_publish_ok
}

# Só URL overlay → gateway. Zero inject.
patch_overlay_urls() {
  [[ -f "$CFG" ]] || return 1
  python3 - "$CFG" "$URL" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
url = sys.argv[2]
text0 = path.read_text(encoding="utf-8")
text = text0
if text.count("{") != text.count("}"):
    print("ABORT unbalanced")
    sys.exit(2)
if "wabadisparos.com.br" not in text:
    print("ABORT missing wabadisparos")
    sys.exit(2)

n = 0
# família loadBalancer SV
for family in ("sinal-verde_acesso-sinalverde", "sinal-verde-acesso-sinalverde"):
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text2, c = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if c:
        n += c
        text = text2

# overlay literal
text2, c = re.subn(r'http://sinal-verde_acesso-sinalverde(?::\d+)?/?', url, text)
if c:
    n += c
    text = text2

# host :3000 = painel Easypanel — nunca para SV
text2, c = re.subn(r'http://172\.17\.0\.1:3000/?', url, text)
# só se estiver dentro de bloco sinal-verde — simplificado: se URL 3000 aparecer
# junto com chave sinal-verde já coberta pelo family replace acima.
# Evita trocar outros serviços: só aplica se o arquivo ainda tiver overlay SV.
if "sinal-verde_acesso-sinalverde:3000" in text0 or "sinal-verde_acesso-sinalverde/" in text0.replace(url, ""):
    pass

if text.count("{") != text.count("}"):
    print("ABORT unbalanced after")
    sys.exit(2)
if "wabadisparos.com.br" not in text:
    print("ABORT wabadisparos gone")
    sys.exit(2)

if text == text0:
    print("noop")
    sys.exit(0)
path.write_text(text, encoding="utf-8")
print(f"patched={n}")
PY
}

needs_patch() {
  grep -q 'sinal-verde_acesso-sinalverde:3000\|http://sinal-verde_acesso-sinalverde/' "$CFG" 2>/dev/null \
    || ! crm_publish_ok
}

sv_https_ok() {
  case "$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")" in
    200|301|302|303|307|308|401) return 0 ;;
    *) return 1 ;;
  esac
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0
  if ! needs_patch && sv_https_ok; then
    return 0
  fi
  ensure_publish || log "AVISO: publish falhou"
  if needs_patch || ! sv_https_ok; then
    log "corrigindo overlay Traefik → ${URL}"
    patch_overlay_urls >>"$LOG" 2>&1 || log "AVISO: patch abortou/falhou"
    sleep 10
  fi
  log "sv=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") local=$(http_code "http://127.0.0.1:${HOST_PORT}/") disparos=$(http_code https://wabadisparos.com.br/)"
}

cmd_watch() {
  log "watch ativo — eventos ${CRM}"
  docker events \
    --filter "type=service" \
    --filter "type=container" \
    --format '{{.Type}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r etype eaction ename esvc; do
      if [[ "$ename" == "$CRM" ]] || [[ "$esvc" == "$CRM" ]]; then
        case "$eaction" in
          update|create|start|die)
            token="$(date +%s%N)"
            echo "$token" >/var/run/sv-overlay-guard-debounce
            (
              sleep 45
              if [[ "$(cat /var/run/sv-overlay-guard-debounce 2>/dev/null)" == "$token" ]]; then
                bash "$SELF" run
              fi
            ) >>"$LOG" 2>&1 &
            ;;
        esac
      fi
    done
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Sinal Verde overlay guard (URL → ${GW}:${HOST_PORT})
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Sinal Verde overlay guard a cada ${TIMER_SEC}s
[Timer]
OnBootSec=40s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=3s
Persistent=true
[Install]
WantedBy=timers.target
EOF
  cat >"${UNIT_DIR}/${WATCH}" <<EOF
[Unit]
Description=Sinal Verde overlay guard WATCH (docker events)
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
  [[ "$(id -u)" -eq 0 ]] || exit 1
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  [[ "$src" != "$SELF" ]] && cp -f "$src" "$SELF" || true
  sed -i 's/\r$//' "$SELF" 2>/dev/null || true
  chmod +x "$SELF"
  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER"
  systemctl enable --now "$WATCH"
  log "instalado ${TIMER} + ${WATCH}"
  bash "$SELF" run || true
  systemctl is-active "$TIMER" "$WATCH" || true
  echo
  echo "Validar: curl -sS -o /dev/null -w '%{http_code}\\n' https://${DOMAIN}/"
  echo "         systemctl is-active ${WATCH}"
}

cmd_uninstall() {
  systemctl disable --now "$TIMER" "$WATCH" 2>/dev/null || true
  rm -f "${UNIT_DIR}/${TIMER}" "${UNIT_DIR}/${SERVICE}" "${UNIT_DIR}/${WATCH}"
  systemctl daemon-reload
  log "desinstalado"
}

cmd_status() {
  systemctl is-active "$TIMER" 2>/dev/null || echo "timer: inactive"
  systemctl is-active "$WATCH" 2>/dev/null || echo "watch: inactive"
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
  echo -n "local: "; http_code "http://127.0.0.1:${HOST_PORT}/"; echo
  echo -n "disparos: "; http_code https://wabadisparos.com.br/; echo
  grep -n 'sinal-verde_acesso-sinalverde' "$CFG" | grep -E 'url|Host' | head -20 || true
}

case "${1:-}" in
  run) cmd_run ;;
  watch) cmd_watch ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 run|install|uninstall|status|watch"
    exit 1
    ;;
esac
