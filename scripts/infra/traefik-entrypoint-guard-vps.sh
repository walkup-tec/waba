#!/bin/bash
# Guard Traefik Easypanel — entryPoints http/https (NUNCA web/websecure neste VPS).
#
# Causa (2026-07-10): routers bets com entryPoints web/websecure (inexistentes no env
# TRAEFIK_ENTRYPOINTS_HTTP / HTTPS) ficavam órfãos no :443 → bet.waba.info 404 SPA.
# paginadevendas já usava http/https e funcionava.
#
# Doc:
#   https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
#   https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
#
# Uso (root no VPS):
#   bash traefik-entrypoint-guard-vps.sh check
#   bash traefik-entrypoint-guard-vps.sh fix
#   bash traefik-entrypoint-guard-vps.sh run      # check + fix se necessário + probe
#   bash traefik-entrypoint-guard-vps.sh install  # timer systemd a cada 3 min
#   bash traefik-entrypoint-guard-vps.sh status
#
# Versão: traefik-entrypoint-guard-2026-07-10-v1
set -euo pipefail

VERSION="traefik-entrypoint-guard-2026-07-10-v1"
CFG="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${WABA_ENTRYPOINT_GUARD_LOG:-/var/log/waba-traefik-entrypoint-guard.log}"
LOCK="${WABA_ENTRYPOINT_GUARD_LOCK:-/var/run/waba-traefik-entrypoint-guard.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-traefik-entrypoint-guard.service"
TIMER="waba-traefik-entrypoint-guard.timer"
BETS_HOST="${WABA_BETS_PUBLIC_HOST:-bet.waba.info}"
DISPAROS_HOST="${WABA_DISPAROS_PUBLIC_HOST:-wabadisparos.com.br}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

http_code() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"
}

body_snip() {
  curl -sS --max-time 12 "$@" 2>/dev/null | tr -d '\0' | head -c 400 || true
}

# Retorna 0 se main.yaml NÃO contém web/websecure em entryPoints
cmd_check() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  local bad
  bad=$(python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
# entryPoints arrays containing web or websecure as tokens
pat = re.compile(r'"entryPoints"\s*:\s*\[(.*?)\]', re.S | re.I)
bad = []
for m in pat.finditer(text):
    inner = m.group(1)
    if re.search(r'["\']websecure["\']', inner, re.I) or re.search(r'["\']web["\']', inner, re.I):
        # context: look back for router key
        start = max(0, m.start() - 200)
        ctx = text[start:m.start()]
        key_m = re.search(r'"(https?-[^"]+)"\s*:\s*\{[^}]*$', ctx, re.S)
        key = key_m.group(1) if key_m else f"@offset{m.start()}"
        bad.append(f"{key}: {m.group(0).replace(chr(10),' ')[:80]}")
# also YAML-style "- websecure"
for m in re.finditer(r'(?m)^\s*-\s*(websecure|web)\s*$', text):
    bad.append(f"yaml-list: {m.group(0).strip()}")
if bad:
    print("\n".join(bad))
    sys.exit(1)
print("OK")
sys.exit(0)
PY
) || true
  local rc=$?
  if [[ "$bad" == "OK" ]]; then
    log "check OK — nenhum entryPoint web/websecure em $CFG"
    return 0
  fi
  log "check FALHA — entryPoints inválidos:"
  while IFS= read -r line; do
    [[ -n "$line" ]] && log "  $line"
  done <<< "$bad"
  return 1
}

cmd_fix() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  [[ "$(id -u)" -eq 0 ]] || { log "ERRO: fix precisa root"; return 2; }
  cp -a "$CFG" "${CFG}.bak-entrypoint-guard-$(date +%s)"
  python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
changes = 0

# 1) JSON-like Easypanel: "entryPoints": [ "web" ] / [ "websecure" ]
# Prefer rename by router key prefix when inside a known http-/https- block.
def fix_block(key: str, block: str) -> str:
    global changes
    if key.startswith("http-") and not key.startswith("https-"):
        ep = "http"
    elif key.startswith("https-"):
        ep = "https"
    else:
        # generic: web->http, websecure->https
        ep = None
    if ep:
        nb, n = re.subn(
            r'"entryPoints"\s*:\s*\[[^\]]*\]',
            f'"entryPoints": ["{ep}"]',
            block,
            count=1,
            flags=re.S | re.I,
        )
        if n and nb != block:
            changes += 1
            print(f"FIX {key} -> entryPoints [\"{ep}\"]")
            return nb
    # fallback token replace inside entryPoints only
    def repl_ep(m):
        global changes
        inner = m.group(1)
        new_inner = re.sub(r'["\']websecure["\']', '"https"', inner, flags=re.I)
        new_inner = re.sub(r'["\']web["\']', '"http"', new_inner, flags=re.I)
        if new_inner != inner:
            changes += 1
            print(f"FIX tokens in {key}")
        return '"entryPoints": [' + new_inner + ']'
    return re.sub(r'"entryPoints"\s*:\s*\[(.*?)\]', repl_ep, block, count=1, flags=re.S | re.I)

pos = 0
out = []
pat = re.compile(r'"(https?-[^"]+|[^"]+)"\s*:\s*\{', re.M)
# Only walk router-like keys (http-/https-) and also any block with entryPoints web*
# Simpler: global replace of entryPoints arrays
def global_fix(t: str) -> str:
    global changes
    def repl(m):
        global changes
        full = m.group(0)
        inner = m.group(1)
        if not re.search(r'websecure|\bweb\b', inner, re.I):
            return full
        # look behind for key
        start = m.start()
        window = t[max(0, start - 300):start]
        key_m = re.search(r'"(https?-[^"]+)"\s*:\s*\{[\s\S]*$', window)
        key = key_m.group(1) if key_m else ""
        if key.startswith("https-"):
            ep = "https"
        elif key.startswith("http-"):
            ep = "http"
        else:
            # token map
            new_inner = re.sub(r'["\']websecure["\']', '"https"', inner, flags=re.I)
            new_inner = re.sub(r'["\']web["\']', '"http"', new_inner, flags=re.I)
            if new_inner != inner:
                changes += 1
                print(f"FIX entryPoints tokens @ {start}")
            return '"entryPoints": [' + new_inner + ']'
        changes += 1
        print(f"FIX {key or '@'+str(start)} -> [\"{ep}\"]")
        return f'"entryPoints": ["{ep}"]'
    return re.sub(r'"entryPoints"\s*:\s*\[(.*?)\]', repl, t, flags=re.S | re.I)

text2 = global_fix(text)
# YAML list style
text3, n_yaml = re.subn(r'(?m)^(\s*-\s*)websecure\s*$', r'\1https', text2)
changes += n_yaml
text3, n_yaml2 = re.subn(r'(?m)^(\s*-\s*)web\s*$', r'\1http', text3)
changes += n_yaml2
if n_yaml or n_yaml2:
    print(f"FIX yaml-list web/websecure -> http/https ({n_yaml + n_yaml2})")

path.write_text(text3, encoding="utf-8")
print(f"changes={changes}")
if changes == 0:
    sys.exit(0)
PY
  log "fix aplicado em $CFG (file watch deve recarregar em poucos segundos)"
  return 0
}

probe_landings() {
  local bet_code disparos_code bet_body
  bet_code=$(http_code --resolve "${BETS_HOST}:443:127.0.0.1" "https://${BETS_HOST}/")
  disparos_code=$(http_code --resolve "${DISPAROS_HOST}:443:127.0.0.1" "https://${DISPAROS_HOST}/")
  bet_body=$(body_snip --resolve "${BETS_HOST}:443:127.0.0.1" "https://${BETS_HOST}/")
  log "probe ${BETS_HOST}=${bet_code} ${DISPAROS_HOST}=${disparos_code}"
  if [[ "$bet_code" =~ ^(200|301|302|304)$ ]] && echo "$bet_body" | grep -qiE 'drax-bets|class="dark"|Bet Waba|segmento de Bets'; then
    log "probe Bets landing OK"
    return 0
  fi
  if echo "$bet_body" | grep -qiE 'Page not found|styles-DY5U|drax-waba'; then
    log "probe Bets ainda parece SPA disparos/404 — entryPoints ou backend"
    return 1
  fi
  if [[ "$bet_code" =~ ^(200|301|302|304)$ ]]; then
    log "probe Bets HTTP OK (corpo não validado)"
    return 0
  fi
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro guard em execução — skip"; return 0; }
  fi

  local need_fix=0
  if ! cmd_check; then
    need_fix=1
  fi

  if [[ "$need_fix" -eq 1 ]]; then
    cmd_fix
    sleep 8
  fi

  if ! probe_landings; then
    # Se probe falha e ainda há web/websecure, fix de novo; senão só reporta
    if ! cmd_check; then
      cmd_fix
      sleep 8
      probe_landings || true
    else
      log "entryPoints OK no disco mas probe Bets falhou — ver backend :30211 / bootstrap :443"
      return 1
    fi
  fi
  return 0
}

cmd_install() {
  [[ "$(id -u)" -eq 0 ]] || { echo "Execute como root"; exit 1; }
  mkdir -p "$INSTALL_DIR" "$(dirname "$LOG")"
  local dest="${INSTALL_DIR}/traefik-entrypoint-guard-vps.sh"
  local src
  src="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  cp "$src" "$dest"
  sed -i 's/\r$//' "$dest" 2>/dev/null || true
  chmod +x "$dest"

  cat >"${UNIT_DIR}/${SERVICE}" <<EOF
[Unit]
Description=WABA Traefik entryPoint guard (http/https, never web/websecure)
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA Traefik entryPoint guard every 3 minutes

[Timer]
OnBootSec=90
OnUnitActiveSec=3min
AccuracySec=20s
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${TIMER}"
  log "instalado ${TIMER}"
  bash "$dest" run || true
  systemctl status "${TIMER}" --no-pager | head -15 || true
}

cmd_status() {
  systemctl is-active "${TIMER}" 2>/dev/null || echo "timer: inactive"
  systemctl list-timers "${TIMER}" --no-pager 2>/dev/null || true
  cmd_check || true
  probe_landings || true
  tail -20 "$LOG" 2>/dev/null || true
}

case "${1:-run}" in
  check) cmd_check ;;
  fix) cmd_fix ;;
  run) cmd_run ;;
  install) cmd_install ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 check|fix|run|install|status"
    exit 2
    ;;
esac
