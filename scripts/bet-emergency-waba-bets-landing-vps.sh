#!/bin/bash
# EMERGÊNCIA — bet.waba.info → WABA /bets (30180). App bets_pv com 404 no TanStack.
# Versão: bet-emergency-waba-bets-landing-2026-07-09-v2
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/bet-emergency-waba-bets.log"
BETS_PUB="bet.waba.info"
WABA_BETS_URL="http://172.17.0.1:30180/bets"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== bet-emergency v2 ==="

curl -sf -m 8 "http://127.0.0.1:30180/bets" >/dev/null || { log "ERRO: /bets não responde em 30180"; exit 1; }

if ! ss -tln | grep -q ':443 '; then
  log "Traefik :443 down — bootstrap"
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-easypanel-bootstrap-vps.sh" -o /tmp/tr-bootstrap.sh
  sed -i 's/\r$//' /tmp/tr-bootstrap.sh && bash /tmp/tr-bootstrap.sh run || true
  sleep 10
fi

cp -a "$CFG" "${CFG}.bak-bet-emergency-v2-$(date +%s)"

python3 <<PY
import re
from pathlib import Path

cfg = Path("${CFG}")
waba_bets_url = "${WABA_BETS_URL}"
text = cfg.read_text(encoding="utf-8")

# Service bets → WABA /bets (path no URL = Traefik encaminha / para /bets)
pat = r'("waba_bets_pv-0"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")'
text, n = re.subn(pat, rf"\g<1>{waba_bets_url}\2", text, count=1)
print(f"service patch: {n}")

# Garantir passHostHeader (WABA precisa do Host público)
m = re.search(r'"waba_bets_pv-0"\s*:\s*\{[\s\S]*?\n      \}', text)
if m and "passHostHeader" not in m.group(0):
    blk = m.group(0).replace(
        '"loadBalancer": {',
        '"loadBalancer": {\n          "passHostHeader": true,',
        1,
    )
    text = text[: m.start()] + blk + text[m.end() :]
    print("passHostHeader: true")

cfg.write_text(text, encoding="utf-8")
print("OK")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 10

for i in 1 2 3 4 5; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null || echo "000")
  log "tentativa $i: ${code}"
  [[ "$code" =~ ^(200|301|302|304)$ ]] && exit 0
  sleep 3
done
exit 1
