#!/bin/bash
# EMERGÊNCIA — todos os sites offline (:443 down ou backends errados).
# Cole no VPS (root@srv1261237):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/emergency-all-sites-vps.sh" -o /tmp/emergency-all.sh
#   sed -i 's/\r$//' /tmp/emergency-all.sh && bash /tmp/emergency-all.sh
#
# Versão: emergency-all-sites-2026-07-09-v1
set -euo pipefail

VERSION="emergency-all-sites-2026-07-09-v1"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/emergency-all-sites.log"
REPO="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== $VERSION START ==="

# 1) Parar automação que briga no main.yaml
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer \
  traefik-permanent-walkup-evo-fix.timer \
  traefik-permanent-paginadevendas-watch \
  traefik-permanent-bets-pv-watch \
  traefik-permanent-waba-watch \
  traefik-permanent-walkup-evo-watch; do
  systemctl disable --now "$u" 2>/dev/null || true
done
log "timers/guard OFF"

# 2) Bootstrap Traefik (:80/:443)
BOOT="/tmp/traefik-easypanel-bootstrap-vps.sh"
curl -fsSL "${REPO}/traefik-easypanel-bootstrap-vps.sh" -o "$BOOT"
sed -i 's/\r$//' "$BOOT" 2>/dev/null || true
chmod +x "$BOOT"
bash "$BOOT" run | tee -a "$LOG" || true

# 3) Backup + patch backends estáveis (172.17.0.1 = host gateway do container Traefik)
[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%H%M%S)"

python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# Portas publicadas no host (validadas neste VPS)
BACKENDS = {
    "waba_waba_disparador": "http://172.17.0.1:30180/",
    "waba_waba-disparador": "http://172.17.0.1:30180/",
    "waba_disparador": "http://172.17.0.1:30180/",
    "waba_paginadevendas": "http://172.17.0.1:30210/",
    "waba_bets_pv": "http://172.17.0.1:30211/",
    "walkup_evo-walkup-api": "http://172.17.0.1:30181/",
    "walkup_evo_walkup-api": "http://172.17.0.1:30181/",
}

for family, url in BACKENDS.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"backend {family}* -> {url} ({n}x)")

# Host() públicos nas landings (se router Easypanel existir)
def inject_host(rule: str, host: str) -> str:
    if f"Host(`{host}`)" in rule:
        return rule
    if "Host(`" in rule:
        return rule.replace("Host(`", f"Host(`{host}`) || Host(`", 1)
    return rule

LANDINGS = [
    ("wabadisparos.com.br", "paginadevendas"),
    ("bet.waba.info", "bets_pv"),
]
for pub, marker in LANDINGS:
    pat = rf'("https?-[^"]*{marker}[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")([^"]+)(")'
    def repl(m, h=pub):
        new_rule = inject_host(m.group(2), h)
        if new_rule != m.group(2):
            print(f"Host({h}) injetado em {m.group(1)[:40]}...")
        return m.group(1) + new_rule + m.group(3)
    text, n = re.subn(pat, repl, text, flags=re.I)
    if n:
        print(f"router {marker}: {n} patch(es)")

# Remover wabadisparos do router do disparador (contaminação)
for marker in ("disparador", "waba_waba", "waba-waba", "waba.draxsistemas"):
    pat = rf'("https?-[^"]*{re.escape(marker)}[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")([^"]*wabadisparos[^"]*)(")'
    def strip_pv(m):
        rule = m.group(2)
        rule = re.sub(r"\s*\|\|\s*Host\(`wabadisparos\.com\.br`\)", "", rule)
        rule = re.sub(r"Host\(`wabadisparos\.com\.br`\)\s*\|\|\s*", "", rule)
        return m.group(1) + rule + m.group(3)
    text, n = re.subn(pat, strip_pv, text, flags=re.I)
    if n:
        print(f"removido wabadisparos de router {marker}")

path.write_text(text, encoding="utf-8")
print("main.yaml OK")
PY

# 4) HUP Traefik (não force update se já 1/1)
CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -z "$CID" ]]; then
  log "Traefik ainda down — force update"
  timeout 120 docker service update --update-failure-action continue --force easypanel-traefik >>"$LOG" 2>&1 || true
  sleep 15
  CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
fi
if [[ -n "$CID" ]]; then
  docker kill -s HUP "$CID" >/dev/null 2>&1 || true
  sleep 5
  log "Traefik HUP ${CID:0:12}"
else
  log "ERRO: Traefik sem container running"
  docker service ps easypanel-traefik --no-trunc | head -8 | tee -a "$LOG"
  exit 1
fi

# 5) Probes
probe() {
  local name="$1" host="$2" path="${3:-/}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
    --resolve "${host}:443:127.0.0.1" "https://${host}${path}" 2>/dev/null || echo "000")
  log "HTTPS ${name}: ${code}"
}

probe "waba" "waba.draxsistemas.com.br" "/health"
probe "disparos" "wabadisparos.com.br" "/"
probe "bets" "bet.waba.info" "/"
probe "evo" "walkup-evo-walkup-api.achpyp.easypanel.host" "/"

log "local ports:"
curl -sS -o /dev/null -w "30180:%{http_code} " --max-time 5 http://127.0.0.1:30180/health 2>/dev/null || echo -n "30180:000 "
curl -sS -o /dev/null -w "30210:%{http_code} " --max-time 5 http://127.0.0.1:30210/ 2>/dev/null || echo -n "30210:000 "
curl -sS -o /dev/null -w "30211:%{http_code}\n" --max-time 5 http://127.0.0.1:30211/ 2>/dev/null || echo "30211:000"

ss -tlnp | grep -E ':443|:80 ' | tee -a "$LOG" || true
log "=== $VERSION END ==="
