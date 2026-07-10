#!/bin/bash
# Guard Traefik Easypanel — entryPoints http/https + backend bets :30211.
#
# Causa (2026-07-10):
# 1) Routers bets com entryPoints web/websecure (inexistentes) → 404 SPA.
# 2) Service URL tasks.* / errada com :30211 OK no host → 502.
#
# Doc:
#   https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/
#   https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
#   https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# Uso (root no VPS):
#   bash traefik-entrypoint-guard-vps.sh check|fix|fix-backend|run|install|status
#
# Versão: traefik-entrypoint-guard-2026-07-10-v2.1
set -euo pipefail

VERSION="traefik-entrypoint-guard-2026-07-10-v2.1"
CFG="${TRAEFIK_MAIN_YAML:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${WABA_ENTRYPOINT_GUARD_LOG:-/var/log/waba-traefik-entrypoint-guard.log}"
LOCK="${WABA_ENTRYPOINT_GUARD_LOCK:-/var/run/waba-traefik-entrypoint-guard.lock}"
INSTALL_DIR="/root/waba-infra"
UNIT_DIR="/etc/systemd/system"
SERVICE="waba-traefik-entrypoint-guard.service"
TIMER="waba-traefik-entrypoint-guard.timer"
BETS_HOST="${WABA_BETS_PUBLIC_HOST:-bet.waba.info}"
DISPAROS_HOST="${WABA_DISPAROS_PUBLIC_HOST:-wabadisparos.com.br}"
BETS_PORT="${WABA_BETS_HOST_PORT:-30211}"
BETS_URL="${WABA_BETS_BACKEND_URL:-http://172.17.0.1:${BETS_PORT}/}"
WATCH_SLEEP="${WABA_ENTRYPOINT_WATCH_SLEEP:-10}"

# Preenchidos por probe_landings
LAST_BET_CODE="000"
LAST_DISPAROS_CODE="000"
LAST_BET_BODY=""

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }

# NÃO use `curl ... || echo 000` — em falha o -w já imprime 000 e o || duplica → "000000"
http_code() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || true)"
  [[ -n "$code" ]] || code="000"
  printf '%s\n' "$code"
}

body_snip() {
  curl -sS --max-time 12 "$@" 2>/dev/null | tr -d '\0' | head -c 400 || true
}

local_bets_ok() {
  local code
  code=$(http_code "http://127.0.0.1:${BETS_PORT}/")
  [[ "$code" =~ ^(200|301|302|304)$ ]]
}

# Retorna 0 se main.yaml NÃO contém web/websecure em entryPoints
cmd_check() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  local bad
  bad=$(python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
pat = re.compile(r'"entryPoints"\s*:\s*\[(.*?)\]', re.S | re.I)
bad = []
for m in pat.finditer(text):
    inner = m.group(1)
    if re.search(r'["\']websecure["\']', inner, re.I) or re.search(r'["\']web["\']', inner, re.I):
        start = max(0, m.start() - 200)
        ctx = text[start:m.start()]
        key_m = re.search(r'"(https?-[^"]+)"\s*:\s*\{[^}]*$', ctx, re.S)
        key = key_m.group(1) if key_m else f"@offset{m.start()}"
        bad.append(f"{key}: {m.group(0).replace(chr(10),' ')[:80]}")
for m in re.finditer(r'(?m)^\s*-\s*(websecure|web)\s*$', text):
    bad.append(f"yaml-list: {m.group(0).strip()}")
if bad:
    print("\n".join(bad))
    sys.exit(1)
print("OK")
sys.exit(0)
PY
) || true
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

def global_fix(t: str) -> str:
    global changes
    def repl(m):
        global changes
        full = m.group(0)
        inner = m.group(1)
        if not re.search(r'websecure|\bweb\b', inner, re.I):
            return full
        start = m.start()
        window = t[max(0, start - 300):start]
        key_m = re.search(r'"(https?-[^"]+)"\s*:\s*\{[\s\S]*$', window)
        key = key_m.group(1) if key_m else ""
        if key.startswith("https-"):
            ep = "https"
        elif key.startswith("http-"):
            ep = "http"
        else:
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
text3, n_yaml = re.subn(r'(?m)^(\s*-\s*)websecure\s*$', r'\1https', text2)
changes += n_yaml
text3, n_yaml2 = re.subn(r'(?m)^(\s*-\s*)web\s*$', r'\1http', text3)
changes += n_yaml2
if n_yaml or n_yaml2:
    print(f"FIX yaml-list web/websecure -> http/https ({n_yaml + n_yaml2})")

path.write_text(text3, encoding="utf-8")
print(f"changes={changes}")
PY
  log "fix entryPoints aplicado em $CFG (file watch ~${WATCH_SLEEP}s)"
  return 0
}

# Força services bets → BETS_URL; garante entryPoints http/https nos routers bets
cmd_fix_backend() {
  [[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; return 2; }
  [[ "$(id -u)" -eq 0 ]] || { log "ERRO: fix-backend precisa root"; return 2; }
  cp -a "$CFG" "${CFG}.bak-bets-backend-$(date +%s)"
  local out
  out=$(python3 - "$CFG" "$BETS_URL" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url = sys.argv[2].rstrip("/") + "/"
text = path.read_text(encoding="utf-8")
changes = 0

keys = (
    "waba_bets_landing_fix",
    "waba_bets_pv-0",
    "waba_bets_pv-1",
    "waba-bets-pv-0",
    "waba-bets-pv-1",
)
for key in keys:
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text2, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    if n:
        # só conta se mudou de fato
        old = re.search(rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*"([^"]+)"', text)
        if old and old.group(1).rstrip("/") + "/" != url:
            changes += 1
            print(f"URL {key}: {old.group(1)} -> {url}")
        elif old and old.group(1).rstrip("/") + "/" == url:
            print(f"URL {key}: já {url}")
        else:
            changes += 1
            print(f"URL {key} -> {url}")
        text = text2

# Routers bets: entryPoints + service preferindo landing_fix se existir
prefer_svc = "waba_bets_pv-0"
if '"waba_bets_landing_fix"' in text:
    prefer_svc = "waba_bets_landing_fix"
for prefix, ep in (("http", "http"), ("https", "https")):
    key = f"{prefix}-waba_bets_pv-0"
    m = re.search(rf'"{re.escape(key)}"\s*:\s*\{{', text)
    if not m:
        continue
    brace = text.find("{", m.start())
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    block = text[m.start():end]
    nb = block
    if '"entryPoints"' in nb:
        nb2 = re.sub(
            r'"entryPoints"\s*:\s*\[[^\]]*\]',
            f'"entryPoints": ["{ep}"]',
            nb,
            count=1,
            flags=re.S,
        )
    else:
        nb2 = nb.replace("{", '{\n        "entryPoints": ["' + ep + '"],', 1)
    if prefer_svc and f'"{prefer_svc}"' in text:
        nb2 = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{prefer_svc}\2", nb2, count=1)
    if nb2 != block:
        changes += 1
        print(f"ROUTER {key} entryPoints={ep} service patched")
        text = text[: m.start()] + nb2 + text[end:]

path.write_text(text, encoding="utf-8")
print(f"backend_changes={changes}")
sys.exit(0 if changes >= 0 else 1)
PY
)
  while IFS= read -r line; do
    [[ -n "$line" ]] && log "  $line"
  done <<< "$out"
  log "fix-backend aplicado (URL ${BETS_URL}); aguardando file watch ${WATCH_SLEEP}s"
  sleep "$WATCH_SLEEP"
  return 0
}

probe_landings() {
  local bet_code disparos_code bet_body
  bet_code=$(http_code --resolve "${BETS_HOST}:443:127.0.0.1" "https://${BETS_HOST}/")
  disparos_code=$(http_code --resolve "${DISPAROS_HOST}:443:127.0.0.1" "https://${DISPAROS_HOST}/")
  bet_body=$(body_snip --resolve "${BETS_HOST}:443:127.0.0.1" "https://${BETS_HOST}/")
  LAST_BET_CODE="$bet_code"
  LAST_DISPAROS_CODE="$disparos_code"
  LAST_BET_BODY="$bet_body"
  log "probe ${BETS_HOST}=${bet_code} ${DISPAROS_HOST}=${disparos_code}"
  if [[ "$bet_code" =~ ^(200|301|302|304)$ ]] && echo "$bet_body" | grep -qiE 'drax-bets|class="dark"|Bet Waba|segmento de Bets'; then
    log "probe Bets landing OK"
    return 0
  fi
  if [[ "$bet_code" == "502" || "$bet_code" == "503" || "$bet_code" == "504" ]]; then
    log "probe Bets ${bet_code} — backend unreachable (URL service / :${BETS_PORT})"
    return 1
  fi
  if [[ "$bet_code" == "000" ]]; then
    log "probe Bets 000 — Traefik/:443 down? rode bootstrap"
    # Se disparos também 000, quase certo que :443 caiu
    if [[ "$disparos_code" == "000" ]]; then
      log "probe disparos também 000 — confirme: ss -tlnp | grep :443"
    fi
    return 1
  fi
  if echo "$bet_body" | grep -qiE 'Page not found|styles-DY5U|drax-waba'; then
    log "probe Bets ${bet_code} SPA disparos/404 — entryPoints ou Host no router errado"
    return 1
  fi
  if [[ "$bet_code" =~ ^(200|301|302|304)$ ]]; then
    log "probe Bets HTTP OK (corpo não validado)"
    return 0
  fi
  log "probe Bets falhou HTTP ${bet_code}"
  return 1
}

heal_bets_if_needed() {
  # entryPoints
  if ! cmd_check; then
    cmd_fix
    sleep "$WATCH_SLEEP"
  fi

  if probe_landings; then
    return 0
  fi

  # 502/503/504 + local :30211 OK → forçar URL gateway
  if [[ "$LAST_BET_CODE" =~ ^(502|503|504)$ ]]; then
    if local_bets_ok; then
      log "heal: :${BETS_PORT} local OK + HTTPS ${LAST_BET_CODE} → fix-backend ${BETS_URL}"
      cmd_fix_backend
      if probe_landings; then
        log "heal: Bets recuperado após fix-backend"
        return 0
      fi
      log "heal: ainda falhou após fix-backend"
      return 1
    fi
    log "heal: :${BETS_PORT} local DOWN — redeploy waba_bets_pv no Easypanel"
    return 1
  fi

  # 404 SPA / entryPoints residual
  if ! cmd_check; then
    cmd_fix
    sleep "$WATCH_SLEEP"
  fi
  if local_bets_ok; then
    log "heal: probe ruim com :${BETS_PORT} OK — reforça backend URL + entryPoints"
    cmd_fix
    cmd_fix_backend
    probe_landings && return 0
  fi

  log "heal: entryPoints OK no disco mas probe Bets falhou (code=${LAST_BET_CODE})"
  return 1
}

cmd_run() {
  mkdir -p "$(dirname "$LOG")"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outro guard em execução — skip"; return 0; }
  fi
  heal_bets_if_needed
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
Description=WABA Traefik entryPoint+backend guard (http/https + :${BETS_PORT})
After=docker.service

[Service]
Type=oneshot
ExecStart=${dest} run
EOF

  cat >"${UNIT_DIR}/${TIMER}" <<EOF
[Unit]
Description=WABA Traefik entryPoint+backend guard every 3 minutes

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
  log "instalado ${TIMER} (${VERSION})"
  # Libera lock residual de run anterior
  rm -f "$LOCK" 2>/dev/null || true
  bash "$dest" run || true
  systemctl status "${TIMER}" --no-pager | head -15 || true
  echo "INSTALLED_VERSION=${VERSION} path=${dest}"
  grep -m1 '^VERSION=' "$dest" || true
}

cmd_status() {
  systemctl is-active "${TIMER}" 2>/dev/null || echo "timer: inactive"
  systemctl list-timers "${TIMER}" --no-pager 2>/dev/null || true
  cmd_check || true
  local_code=$(http_code "http://127.0.0.1:${BETS_PORT}/")
  log "local :${BETS_PORT}=${local_code} expect URL ${BETS_URL}"
  probe_landings || true
  tail -25 "$LOG" 2>/dev/null || true
}

case "${1:-run}" in
  check) cmd_check ;;
  fix) cmd_fix ;;
  fix-backend) cmd_fix_backend ;;
  run) cmd_run ;;
  install) cmd_install ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 check|fix|fix-backend|run|install|status"
    exit 2
    ;;
esac
