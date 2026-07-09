#!/bin/bash
# bet.waba.info → WABA landing /bets (30180) — patch MÍNIMO, sem rebuild de routers.
# Pré-requisito: curl http://127.0.0.1:30180/bets → 200
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-proxy-waba-bets-vps.sh" -o /tmp/fix-bet-proxy.sh
#   sed -i 's/\r$//' /tmp/fix-bet-proxy.sh && bash /tmp/fix-bet-proxy.sh
#
# Versão: fix-bet-proxy-waba-bets-2026-07-09-v1
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-proxy-waba-bets.log"
WABA_URL="http://172.17.0.1:30180/"
MW="bet-waba-to-bets-path"
BETS_PUB="bet.waba.info"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== fix-bet-proxy-waba-bets ==="

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 6 http://127.0.0.1:30180/bets 2>/dev/null || echo "000")
[[ "$code" =~ ^(200|301|302|304)$ ]] || { log "ERRO: :30180/bets = ${code}"; exit 1; }
log ":30180/bets OK (${code})"

cp -a "$CFG" "${CFG}.bak-bet-proxy-$(date +%s)"

python3 - "$CFG" "$WABA_URL" "$MW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
waba_url = sys.argv[2]
mw = sys.argv[3]
text = path.read_text(encoding="utf-8")

mw_block = f'''      "{mw}": {{
        "replacePath": {{
          "path": "/bets"
        }}
      }},'''

if f'"{mw}"' not in text:
    idx = text.find('"waba_bets_pv-0"')
    if idx < 0:
        print("ERRO: âncora waba_bets_pv-0 ausente")
        sys.exit(2)
    text = text[:idx] + mw_block + "\n      " + text[idx:]
    print(f"middleware {mw} OK")

for key in ("waba_bets_pv-0", "waba_bets_pv-1"):
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{waba_url}\2", text, count=1)
    if n:
        print(f"{key} url -> {waba_url}")

# HTTPS router bets: middleware + service -0
pat = r'("https-[^"]*bets[_-]pv[^"]*"\s*:\s*\{)([\s\S]*?)(\n      \})'

def fix_https(m):
    body = m.group(2)
    body = re.sub(r'("service"\s*:\s*")[^"]+(")', r'\g<1>waba_bets_pv-0\2', body, count=1)
    if f'"{mw}"' not in body:
        if '"middlewares"' in body:
            body = re.sub(
                r'"middlewares"\s*:\s*\[([^\]]*)\]',
                lambda mm: f'"middlewares": [{mm.group(1).strip() + ", " if mm.group(1).strip() else ""}"{mw}"]',
                body, count=1,
            )
        elif '"service"' in body:
            body = re.sub(
                r'("service"\s*:\s*"[^"]+",)\n',
                rf'\1\n        "middlewares": ["{mw}"],\n',
                body, count=1,
            )
    return m.group(1) + body + m.group(3)

text, n = re.subn(pat, fix_https, text, count=1, flags=re.I)
print(f"https bets router patch ({n})")

if text.count("{") != text.count("}"):
    print("ERRO: chaves desbalanceadas")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("OK")
PY

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$CID" ]] || { log "ERRO: Traefik down"; exit 1; }
touch "$CFG"
sleep 8
docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 10

if ! ss -tln | grep -q ':443 '; then
  log "ERRO: :443 caiu — restaure backup e rode traefik-recover-443-minimal-vps.sh"
  exit 1
fi

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
  --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null || echo "000")
body=$(curl -sS --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null | head -c 120 || true)
log "bet.waba.info -> ${code} | ${body}"
[[ "$code" =~ ^(200|301|302|304)$ ]] && exit 0
exit 1
