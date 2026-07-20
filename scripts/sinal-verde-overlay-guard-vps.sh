#!/bin/bash
# Guard Sinal Verde — v3 SEGURO: NUNCA usa regex que atravessa blocos.
# Só altera chaves EXATAS de service SV (não http-/https-).
# NÃO imprime/consulta WABA. NÃO toca waba_paginadevendas / bets / disparador.
#
# Uso: install|run|status|uninstall
set -euo pipefail

VERSION="sinal-verde-overlay-guard-2026-07-20-v3-isolated"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="/var/log/sinal-verde-overlay-guard.log"
LOCK="/var/run/sinal-verde-overlay-guard.lock"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/sinal-verde-overlay-guard-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="sinal-verde-overlay-guard.timer"
SERVICE="sinal-verde-overlay-guard.service"
WATCH="sinal-verde-overlay-guard-watch.service"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
TARGET_PORT=3000
DOMAIN="acesso-sinalverde.com"
GW="172.17.0.1"
URL="http://${GW}:${HOST_PORT}/"
TIMER_SEC=20

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$@" 2>/dev/null || echo 000; }

with_lock() {
  command -v flock >/dev/null 2>&1 || return 0
  exec 9>"$LOCK"
  flock -w 20 9 || return 1
}

crm_publish_ok() {
  docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null \
    | grep -q "\"PublishedPort\":${HOST_PORT}"
}

ensure_publish() {
  docker service ls --format '{{.Name}}' | grep -qx "$CRM" || return 1
  crm_publish_ok && return 0
  log "publish :${HOST_PORT}"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=${TARGET_PORT},protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || return 1
  sleep 4
}

# SOMENTE services SV por chave exata — zero regex atravessando yaml
patch_sv_urls_only() {
  python3 - "$CFG" "$URL" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
url = sys.argv[2]
text = path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    print("ABORT")
    sys.exit(2)

EXACT = (
    "sinal-verde_acesso-sinalverde-0",
    "sinal-verde_acesso-sinalverde-1",
)

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1], start, i + 1
    raise RuntimeError("no block")

n = 0
for key in EXACT:
    idx = 0
    while True:
        pos = text.find(f'"{key}"', idx)
        if pos < 0:
            break
        if not re.match(rf'"{re.escape(key)}"\s*:\s*\{{', text[pos:]):
            idx = pos + 1
            continue
        block, a, b = extract_block(text, pos)
        # nunca patchar routers
        if key.startswith("http-") or "entryPoints" in block and "loadBalancer" not in block:
            idx = b
            continue
        if "loadBalancer" not in block or '"url"' not in block:
            idx = b
            continue
        nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        if c and nb != block:
            text = text[:a] + nb + text[b:]
            b = a + len(nb)
            n += 1
            print(f"{key} -> {url}")
        idx = b

if text.count("{") != text.count("}"):
    print("ABORT2")
    sys.exit(2)
# Abortar se algum service WABA ficou com :30310 (nunca deve)
for wk in ("waba_paginadevendas-0", "waba_bets_pv-0", "waba_waba_disparador-0"):
    p = text.find(f'"{wk}"')
    if p < 0:
        continue
    if not re.match(rf'"{re.escape(wk)}"\s*:\s*\{{', text[p:]):
        continue
    block, _, _ = extract_block(text, p)
    if "30310" in block:
        print(f"ABORT WABA {wk} has 30310")
        sys.exit(3)
if n:
    path.write_text(text, encoding="utf-8")
print(f"patched={n}")
PY
}

needs_fix() {
  # overlay still present on SV services
  python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
t = Path(sys.argv[1]).read_text(encoding="utf-8")
for key in ("sinal-verde_acesso-sinalverde-0", "sinal-verde_acesso-sinalverde-1"):
    m = re.search(rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\}}', t)
    if not m:
        continue
    block = m.group(0)
    if "loadBalancer" in block and ("sinal-verde_acesso-sinalverde:3000" in block or ":3000/" in block and "172.17.0.1:30310" not in block):
        if "172.17.0.1:30310" not in block:
            sys.exit(0)
sys.exit(1)
PY
}

sv_ok() {
  case "$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")" in
    200|301|302|303|307|308) return 0 ;;
    *) return 1 ;;
  esac
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  with_lock || return 0
  ensure_publish || true
  if needs_fix || ! sv_ok; then
    log "patch SV URLs only"
    patch_sv_urls_only >>"$LOG" 2>&1 || true
    sleep 8
  fi
  log "sv=$(http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/") local=$(http_code http://127.0.0.1:${HOST_PORT}/)"
}

cmd_watch() {
  docker events --filter type=service --filter type=container \
    --format '{{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.com.docker.swarm.service.name}}' \
    2>>"$LOG" | while read -r action name svc; do
      if [[ "$name" == "$CRM" || "$svc" == "$CRM" ]]; then
        token=$(date +%s%N)
        echo "$token" >/var/run/sv-guard-deb
        ( sleep 55; [[ "$(cat /var/run/sv-guard-deb 2>/dev/null)" == "$token" ]] && bash "$SELF" run ) >>"$LOG" 2>&1 &
      fi
    done
}

install_units() {
  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=Sinal Verde guard ISOLADO (só URLs SV)
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Sinal Verde guard ISOLADO timer
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
Description=Sinal Verde guard ISOLADO watch
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
  [[ "$src" != "$SELF" ]] && cp -f "$src" "$SELF" || true
  sed -i 's/\r$//' "$SELF"; chmod +x "$SELF"
  install_units
  systemctl daemon-reload
  systemctl enable --now "$TIMER" "$WATCH"
  bash "$SELF" run || true
  systemctl is-active "$TIMER" "$WATCH"
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
}

cmd_uninstall() {
  systemctl disable --now "$TIMER" "$WATCH" 2>/dev/null || true
  rm -f "${UNIT_DIR}/$TIMER" "${UNIT_DIR}/$SERVICE" "${UNIT_DIR}/$WATCH"
  systemctl daemon-reload
}

cmd_status() {
  systemctl is-active "$TIMER" 2>/dev/null || echo inactive
  systemctl is-active "$WATCH" 2>/dev/null || echo inactive
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
}

case "${1:-}" in
  run) cmd_run ;;
  watch) cmd_watch ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *) echo "Uso: $0 install|run|status|uninstall"; exit 1 ;;
esac
