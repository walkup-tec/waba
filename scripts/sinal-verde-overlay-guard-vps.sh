#!/bin/bash
# Guard Sinal Verde — v4 ISOLADO: edita APENAS sinal-verde.yaml.
# NUNCA patcha main.yaml (WABA). Se Easypanel recriar chaves SV no main → strip-only.
#
# Doc: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# Uso: install|run|status|uninstall|watch
set -euo pipefail

VERSION="sinal-verde-overlay-guard-2026-07-20-v4-isolated-yaml"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SV_YAML="${TRAEFIK_SV_YAML:-${CFG_DIR}/sinal-verde.yaml}"
LOG="/var/log/sinal-verde-overlay-guard.log"
LOCK="/var/run/sinal-verde-overlay-guard.lock"
INSTALL_DIR="/root/waba-infra"
SELF="${INSTALL_DIR}/sinal-verde-overlay-guard-vps.sh"
SPLIT="${INSTALL_DIR}/traefik-split-sinal-verde-yaml-vps.sh"
FIX="${INSTALL_DIR}/fix-sinal-verde-traefik-safe-vps.sh"
UNIT_DIR="/etc/systemd/system"
TIMER="sinal-verde-overlay-guard.timer"
SERVICE="sinal-verde-overlay-guard.service"
WATCH="sinal-verde-overlay-guard-watch.service"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
TARGET_PORT=3000
DOMAIN="acesso-sinalverde.com"
URL="http://172.17.0.1:${HOST_PORT}/"
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

# Patch SOMENTE sinal-verde.yaml
patch_sv_yaml_only() {
  [[ -f "$SV_YAML" ]] || {
    log "AVISO: $SV_YAML ausente — precisa split primeiro"
    return 1
  }
  python3 - "$SV_YAML" "$URL" <<'PY'
import json, re, sys
from pathlib import Path
path, url = Path(sys.argv[1]), sys.argv[2]
raw = path.read_text(encoding="utf-8")
try:
    data = json.loads(raw)
except Exception:
    text = raw
    n = 0
    for key in ("sinal-verde_acesso-sinalverde-0", "sinal-verde_acesso-sinalverde-1"):
        idx = 0
        while True:
            pos = text.find(f'"{key}"', idx)
            if pos < 0:
                break
            brace = text.find("{", pos)
            depth = 0
            end = None
            for i, ch in enumerate(text[brace:], brace):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end is None:
                break
            block = text[pos:end]
            if "loadBalancer" in block and url not in block:
                nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
                if c:
                    text = text[:pos] + nb + text[end:]
                    end = pos + len(nb)
                    n += 1
            idx = end
    if n:
        path.write_text(text, encoding="utf-8")
    print(f"patched_raw={n}")
    sys.exit(0)

n = 0
for k, v in list(data.items()):
    if not isinstance(v, dict):
        continue
    if "loadBalancer" in v:
        cur = ""
        try:
            cur = (v.get("loadBalancer") or {}).get("servers", [{}])[0].get("url", "")
        except Exception:
            cur = ""
        if cur != url:
            v.setdefault("loadBalancer", {})["servers"] = [{"url": url}]
            n += 1
            print(f"{k} -> {url}")
    if "entryPoints" in v and isinstance(v["entryPoints"], list):
        fixed = []
        ch = False
        for ep in v["entryPoints"]:
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
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"patched={n}")
PY
}

strip_sv_from_main_if_present() {
  [[ -f "$MAIN" ]] || return 0
  grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null || return 0
  log "Easypanel recriou SV no main.yaml — strip-only (não toca WABA)"
  if [[ -x "$SPLIT" ]]; then
    bash "$SPLIT" strip-main >>"$LOG" 2>&1 || log "strip falhou"
  fi
}

needs_fix() {
  [[ -f "$SV_YAML" ]] || return 0
  python3 - "$SV_YAML" "$URL" <<'PY'
import json, sys
from pathlib import Path
path, url = Path(sys.argv[1]), sys.argv[2]
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    t = path.read_text(encoding="utf-8")
    if "172.17.0.1:30310" not in t:
        sys.exit(0)
    sys.exit(1)
for k, v in data.items():
    if isinstance(v, dict) and "loadBalancer" in v:
        try:
            u = v["loadBalancer"]["servers"][0]["url"]
        except Exception:
            sys.exit(0)
        if u != url:
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
  strip_sv_from_main_if_present
  if [[ ! -f "$SV_YAML" ]]; then
    log "sinal-verde.yaml ausente — skip patch (rode split)"
    return 0
  fi
  if needs_fix || ! sv_ok; then
    log "patch só $SV_YAML"
    patch_sv_yaml_only >>"$LOG" 2>&1 || true
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
Description=Sinal Verde guard v4 — só sinal-verde.yaml
After=docker.service
[Service]
Type=oneshot
ExecStart=${SELF} run
EOF
  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=Sinal Verde guard v4 timer
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
Description=Sinal Verde guard v4 watch
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
  # Copiar scripts irmãos se existirem no mesmo dir do source
  local_dir="$(dirname "$src")"
  for f in traefik-split-sinal-verde-yaml-vps.sh fix-sinal-verde-traefik-safe-vps.sh fix-sinal-verde-isolated-yaml-vps.sh; do
    if [[ -f "${local_dir}/${f}" && "${local_dir}/${f}" != "${INSTALL_DIR}/${f}" ]]; then
      cp -f "${local_dir}/${f}" "${INSTALL_DIR}/${f}"
      sed -i 's/\r$//' "${INSTALL_DIR}/${f}"
      chmod +x "${INSTALL_DIR}/${f}"
    fi
  done
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
  echo "sv_yaml=$( [[ -f $SV_YAML ]] && echo present || echo MISSING )"
  echo -n "sv: "; http_code --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/"; echo
  if [[ -f "$MAIN" ]] && grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN"; then
    echo "WARN: main.yaml ainda tem chaves SV"
  else
    echo "main: limpo SV"
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
