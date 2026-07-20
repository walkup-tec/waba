#!/bin/bash
# Guard Soma CRM — edita APENAS soma-crm.yaml (+ strip chaves Soma do main se Easypanel recriar).
# NUNCA patcha WABA / Sinal Verde.
#
# Uso: install|run|status|uninstall|watch
set -euo pipefail

VERSION="soma-crm-overlay-guard-2026-07-20-v1"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SOMA_YAML="${TRAEFIK_SOMA_YAML:-${CFG_DIR}/soma-crm.yaml}"
LOG="/var/log/soma-crm-overlay-guard.log"
LOCK="/var/run/soma-crm-overlay-guard.lock"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/soma-crm-overlay-guard-vps.sh"
FIX="${INSTALL_DIR}/fix-soma-crm-isolated-yaml-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="soma-crm-overlay-guard.timer"
SERVICE="soma-crm-overlay-guard.service"
WATCH="soma-crm-overlay-guard-watch.service"
HOST_PORT=30300
TARGET_PORT=3000
DOMAIN="app.somaconecta.com.br"
URL="http://172.17.0.1:${HOST_PORT}/"
TIMER_SEC=45

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null || echo 000; }

with_lock() {
  command -v flock >/dev/null 2>&1 || return 0
  exec 9>"$LOCK"
  flock -w 20 9 || return 1
}

detect_crm() {
  for cand in soma-promotora_gestao-interno soma-promotora_gestao; do
    docker service ls --format '{{.Name}}' | grep -qx "$cand" && { echo "$cand"; return; }
  done
  docker service ls --format '{{.Name}}' | grep -iE 'soma.*gestao|gestao-interno' | head -1 || true
}

ensure_publish() {
  local CRM
  CRM="$(detect_crm)"
  [[ -n "$CRM" ]] || return 1
  docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -q "\"PublishedPort\":${HOST_PORT}" && return 0
  log "publish :${HOST_PORT} ($CRM)"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || return 1
  sleep 4
}

patch_soma_yaml() {
  [[ -f "$SOMA_YAML" ]] || {
    log "soma-crm.yaml ausente — rodando fix"
    [[ -x "$FIX" ]] && bash "$FIX" >>"$LOG" 2>&1 || return 1
    return 0
  }
  python3 - "$SOMA_YAML" "$URL" <<'PY'
import json, sys
from pathlib import Path
path, url = Path(sys.argv[1]), sys.argv[2]
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception as e:
    print(f"parse_err={e}")
    sys.exit(1)
n = 0
http = data.get("http") or data
services = http.get("services") or {}
for k, v in list(services.items()):
    if not isinstance(v, dict) or "loadBalancer" not in v:
        continue
    try:
        cur = (v.get("loadBalancer") or {}).get("servers", [{}])[0].get("url", "")
    except Exception:
        cur = ""
    if cur != url:
        v.setdefault("loadBalancer", {})["servers"] = [{"url": url}]
        n += 1
        print(f"{k} -> {url}")
routers = http.get("routers") or {}
for k, v in list(routers.items()):
    if not isinstance(v, dict):
        continue
    eps = v.get("entryPoints")
    if isinstance(eps, list):
        fixed = []
        ch = False
        for ep in eps:
            if ep in ("websecure", "web-secure"):
                fixed.append("https"); ch = True
            elif ep == "web":
                fixed.append("http"); ch = True
            else:
                fixed.append(ep)
        if ch:
            v["entryPoints"] = fixed
            n += 1
if n:
    if "http" in data:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    else:
        path.write_text(json.dumps({"http": http}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"patched={n}")
PY
}

strip_soma_from_main() {
  [[ -f "$MAIN" ]] || return 0
  grep -qiE 'soma-promotora|gestao-interno|somaconecta' "$MAIN" 2>/dev/null || return 0
  log "Easypanel recriou Soma no main — strip-only"
  [[ -x "$FIX" ]] && bash "$FIX" >>"$LOG" 2>&1 || true
}

soma_ok() {
  local c h
  c="$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")"
  h="$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health")"
  case "$h" in 200) return 0 ;; esac
  case "$c" in 200|301|302|307|308) return 0 ;; esac
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0
  ensure_publish || true
  strip_soma_from_main
  if ! soma_ok; then
    log "patch soma-crm.yaml"
    patch_soma_yaml >>"$LOG" 2>&1 || true
    sleep 8
  fi
  log "soma=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") health=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health") local=$(http_code http://127.0.0.1:${HOST_PORT}/api/health)"
}

cmd_watch() {
  local CRM
  CRM="$(detect_crm)"
  docker events --filter type=service --filter type=container \
    --format '{{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r action name svc; do
      if [[ -n "$CRM" && ( "$name" == "$CRM" || "$svc" == "$CRM" ) ]]; then
        token=$(date +%s%N)
        echo "$token" >/var/run/soma-guard-deb
        ( sleep 55; [[ "$(cat /var/run/soma-guard-deb 2>/dev/null)" == "$token" ]] && bash "$SELF" run ) >>"$LOG" 2>&1 &
      fi
    done
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Soma CRM guard — só soma-crm.yaml
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Soma CRM guard timer
[Timer]
OnBootSec=50s
OnUnitActiveSec=${TIMER_SEC}s
AccuracySec=5s
Persistent=true
[Install]
WantedBy=timers.target
EOF
  cat >"${UNIT_DIR}/${WATCH}" <<EOF
[Unit]
Description=Soma CRM guard watch
After=docker.service
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
  src=$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
  if [[ "$src" != "$SELF" ]]; then
    cp -f "$src" "$SELF"
  fi
  sed -i 's/\r$//' "$SELF"; chmod +x "$SELF"
  local_dir="$(dirname "$src")"
  if [[ -f "${local_dir}/fix-soma-crm-isolated-yaml-vps.sh" && "${local_dir}/fix-soma-crm-isolated-yaml-vps.sh" != "$FIX" ]]; then
    cp -f "${local_dir}/fix-soma-crm-isolated-yaml-vps.sh" "$FIX"
    sed -i 's/\r$//' "$FIX"; chmod +x "$FIX"
  fi
  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER" "$WATCH"
  bash "$SELF" run || true
  systemctl is-active "$TIMER" "$WATCH"
  echo -n "soma: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health"; echo
}

cmd_uninstall() {
  systemctl disable --now "$TIMER" "$WATCH" 2>/dev/null || true
  rm -f "${UNIT_DIR}/$TIMER" "${UNIT_DIR}/$SERVICE" "${UNIT_DIR}/$WATCH"
  systemctl daemon-reload
}

cmd_status() {
  systemctl is-active "$TIMER" 2>/dev/null || echo inactive
  systemctl is-active "$WATCH" 2>/dev/null || echo inactive
  echo "soma_yaml=$( [[ -f $SOMA_YAML ]] && echo present || echo MISSING )"
  echo -n "soma_health: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health"; echo
  if [[ -f "$MAIN" ]] && grep -qiE 'soma-promotora|gestao-interno|somaconecta' "$MAIN"; then
    echo "WARN: main.yaml ainda tem chaves Soma"
  else
    echo "main: limpo Soma"
  fi
}

case "${1:-}" in
  run) cmd_run ;;
  watch) cmd_watch ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *) echo "Uso: $0 install|run|status|uninstall"; exit 1 ;;
esac
