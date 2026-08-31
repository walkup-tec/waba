#!/bin/bash
# Recupera :443 após rebuild que derrubou Traefik.
# 1) Restaura backup pré-rebuild (config parseável)
# 2) Patch MÍNIMO: só corrige bloco http-bets corrompido + URLs
# 3) Bootstrap Traefik (SEM HUP agressivo)
# 4) restore-landing-routers para Host() + backends
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-recover-443-minimal-vps.sh" -o /tmp/recover.sh
#   sed -i 's/\r$//' /tmp/recover.sh && bash /tmp/recover.sh
#
# Versão: traefik-recover-443-minimal-2026-07-09-v1
set -euo pipefail

VERSION="traefik-recover-443-minimal-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
CFG_DIR="/etc/easypanel/traefik/config"
LOG="/var/log/traefik-recover-443-minimal.log"
REPO="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
GW="172.17.0.1"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }
port443() { ss -tln 2>/dev/null | grep -q ':443 '; }

log "=== $VERSION ==="

for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-walkup-evo-fix.timer traefik-permanent-walkup-evo-watch.service \
  traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-paginadevendas-watch.service \
  traefik-permanent-waba-fix.timer traefik-permanent-waba-watch.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers OFF"

# --- Restaurar backup pré-rebuild (tinha 404, mas Traefik subia) ---
RESTORE_SRC=""
for cand in \
  "$(ls -t "${CFG_DIR}"/main.yaml.bak-traefik-rebuild-landings-clean-* 2>/dev/null | head -1)" \
  "${CFG_DIR}/main.yaml.golden-traefik-all"; do
  [[ -n "$cand" && -f "$cand" && -s "$cand" ]] && RESTORE_SRC="$cand" && break
done

if [[ -n "$RESTORE_SRC" ]]; then
  cp -a "$CFG" "${CFG}.bak-before-recover-$(date +%s)" 2>/dev/null || true
  cp -a "$RESTORE_SRC" "$CFG"
  log "restaurado de: $RESTORE_SRC"
else
  log "AVISO: sem backup — patch no main.yaml atual"
fi

cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

python3 - "$CFG" "$GW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
gw = sys.argv[2]
text = path.read_text(encoding="utf-8")

BETS_RULE = "(Host(`waba-bets-pv.achpyp.easypanel.host`) || Host(`bet.waba.info`)) && PathPrefix(`/`)"
BETS_URL = f"http://{gw}:30211/"
PV_URL = f"http://{gw}:30210/"

HTTP_BETS = '''      "http-waba_bets_pv-0": {
        "entryPoints": ["http"],
        "service": "waba_bets_pv-0",
        "rule": "''' + BETS_RULE + '''",
        "priority": 1000
      },'''

def replace_key_block(s: str, key: str, new_block: str) -> str:
    needle = f'"{key}"'
    idx = s.find(needle)
    if idx < 0:
        print(f"skip {key} (ausente)")
        return s
    brace = s.find("{", idx)
    depth, end = 0, brace
    for i, ch in enumerate(s[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    tail = end
    while tail < len(s) and s[tail] in " \t\r\n":
        tail += 1
    if tail < len(s) and s[tail] == ",":
        tail += 1
    print(f"replace block {key}")
    return s[:idx] + new_block.rstrip(",") + "," + s[tail:]

# Só corrigir bloco http bets se corrompido
if re.search(r'"waba_bets_pv-0"\s*,\s*\n\s*"rule"', text):
    text = replace_key_block(text, "http-waba_bets_pv-0", HTTP_BETS)
    print("bloco http-waba_bets_pv-0 reconstruído (órfão removido)")

# URLs — cirúrgico
for key, url in (
    ("waba_bets_pv-0", BETS_URL),
    ("waba_bets_pv-1", BETS_URL),
    ("waba_paginadevendas-0", PV_URL),
    ("waba_paginadevendas-1", PV_URL),
):
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    if n:
        print(f"{key} -> {url}")

text = re.sub(r",\s*,", ",", text)

if text.count("{") != text.count("}"):
    print(f"ERRO: chaves {{={text.count('{')} }}={text.count('}')}")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("patch mínimo OK")
PY

# --- Subir Traefik (:443) ---
BOOT="/tmp/traefik-easypanel-bootstrap-vps.sh"
curl -fsSL "${REPO}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOT"
sed -i 's/\r$//' "$BOOT" 2>/dev/null || true
chmod +x "$BOOT"
bash "$BOOT" run 2>&1 | tee -a "$LOG" || true

for i in $(seq 1 24); do port443 && break; sleep 3; done
if ! port443; then
  log "ERRO: :443 ainda down após bootstrap"
  docker service ps easypanel-traefik --no-trunc 2>/dev/null | head -6 | tee -a "$LOG"
  exit 1
fi
log ":443 UP"

# --- restore-landing (Host público + backends, sem replace global) ---
RESTORE="/tmp/restore-landing-routers-vps.sh"
curl -fsSL "${REPO}/restore-landing-routers-vps.sh" -o "$RESTORE"
sed -i 's/\r$//' "$RESTORE" 2>/dev/null || true
chmod +x "$RESTORE"
bash "$RESTORE" 2>&1 | tee -a "$LOG" || true

sleep 8

log "disparos -> $(http_code --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/)"
log "bet -> $(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)"
log "=== fim $VERSION ==="
