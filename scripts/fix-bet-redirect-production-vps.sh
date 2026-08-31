#!/bin/bash
# bet.waba.info → 302 para https://waba.draxsistemas.com.br/bets
# NÃO mexe em service URL — só middleware redirect no router HTTPS bets.
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-redirect-production-vps.sh" -o /tmp/bet-redirect.sh
#   sed -i 's/\r$//' /tmp/bet-redirect.sh && bash /tmp/bet-redirect.sh
#
# Versão: fix-bet-redirect-production-2026-07-09-v1
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-redirect-production.log"
REPO="${WABA_SCRIPTS_REPO:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"
RD="bet-waba-redirect-to-waba-bets"
BETS_PUB="bet.waba.info"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== fix-bet-redirect-production ==="

# Timers OFF
for u in traefik-permanent-walkup-evo-fix.timer traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-paginadevendas-fix.timer traefik-easypanel-config-guard.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done

# Se disparos ou bet derem "404 page not found" → restaurar routers primeiro
body=$(curl -sS --max-time 10 "https://wabadisparos.com.br/" 2>/dev/null | head -c 80 || true)
if echo "$body" | grep -q "404 page not found"; then
  log "main.yaml quebrado — restore-landing"
  RESTORE="/tmp/restore-landing.sh"
  curl -fsSL "${REPO}/restore-landing-routers-vps.sh" -o "$RESTORE"
  sed -i 's/\r$//' "$RESTORE" && chmod +x "$RESTORE"
  bash "$RESTORE" >>"$LOG" 2>&1 || true
fi

cp -a "$CFG" "${CFG}.bak-bet-redirect-$(date +%s)"

python3 - "$CFG" "$RD" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
rd = sys.argv[2]
text = path.read_text(encoding="utf-8")

if f"Host(`bet.waba.info`)" not in text:
    print("ERRO: Host(bet.waba.info) ausente — rode restore-landing-routers-vps.sh")
    sys.exit(2)

rd_block = f'''      "{rd}": {{
        "redirectRegex": {{
          "regex": "^https?://bet\\\\.waba\\\\.info(/.*)?",
          "replacement": "https://waba.draxsistemas.com.br/bets",
          "permanent": false
        }}
      }},'''

if f'"{rd}"' not in text:
    idx = text.find('"https-waba_bets_pv')
    if idx < 0:
        idx = text.find('"waba_bets_pv-0"')
    if idx < 0:
        print("ERRO: âncora bets ausente")
        sys.exit(2)
    text = text[:idx] + rd_block + "\n      " + text[idx:]
    print(f"middleware {rd} inserido")

pat = r'("https-[^"]*bets[_-]pv[^"]*"\s*:\s*\{)([\s\S]*?)(\n      \})'

def fix_router(m):
    body = m.group(2)
    # redirect substitui middlewares anteriores (replacePath quebrou)
    if '"middlewares"' in body:
        body = re.sub(r'"middlewares"\s*:\s*\[[^\]]*\]', f'"middlewares": ["{rd}"]', body, count=1)
    else:
        body = re.sub(
            r'("service"\s*:\s*"[^"]+",)\n',
            rf'\1\n        "middlewares": ["{rd}"],\n',
            body, count=1,
        )
    return m.group(1) + body + m.group(3)

text, n = re.subn(pat, fix_router, text, count=1, flags=re.I)
if n == 0:
    print("ERRO: router https bets não encontrado")
    sys.exit(2)
print(f"router https bets -> redirect ({n})")

if text.count("{") != text.count("}"):
    print("ERRO: chaves desbalanceadas")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("OK")
PY

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$CID" ]] || { log "ERRO: Traefik down"; exit 1; }
touch "$CFG"
docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 12

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 -L "https://${BETS_PUB}/" 2>/dev/null || echo "000")
log "PRODUÇÃO ${BETS_PUB} (com -L) -> ${code}"
code0=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "https://${BETS_PUB}/" 2>/dev/null || echo "000")
log "PRODUÇÃO ${BETS_PUB} (sem -L) -> ${code0}"

[[ "$code0" =~ ^(301|302|303|307|308)$ ]] || [[ "$code" =~ ^(200|301|302)$ ]] && exit 0
exit 1
