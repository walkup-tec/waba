#!/bin/bash
# bet.waba.info → 404 com Traefik OK e :30211 local 200.
# Corrige: passHostHeader + service waba_bets_pv-1 (HTTPS Easypanel usa -1).
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-https-404-vps.sh" -o /tmp/fix-bet.sh
#   sed -i 's/\r$//' /tmp/fix-bet.sh && bash /tmp/fix-bet.sh
#
# Versão: fix-bet-https-404-2026-07-09-v1
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-https-404.log"
BETS_URL="http://172.17.0.1:30211/"
BETS_PUB="bet.waba.info"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
probe() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null || echo "000"; }

log "=== fix-bet-https-404 ==="
log "antes: local=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:30211/ 2>/dev/null) https=$(probe)"

cp -a "$CFG" "${CFG}.bak-fix-bet-https-$(date +%s)"

python3 - "$CFG" "$BETS_URL" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url = sys.argv[2].rstrip("/") + "/"
text = path.read_text(encoding="utf-8")

# Services bets_pv-0 e bets_pv-1 → 30211, passHostHeader false
for key in ("waba_bets_pv-0", "waba_bets_pv-1"):
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, count=1)
    if n:
        print(f"url {key} -> {url}")
    blk_pat = rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n      \}}'
    m = re.search(blk_pat, text)
    if not m:
        continue
    blk = m.group(0)
    if "passHostHeader" in blk:
        blk2 = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": false', blk, count=1)
    else:
        blk2 = blk.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": false,', 1)
    if blk2 != blk:
        text = text[: m.start()] + blk2 + text[m.end() :]
        print(f"passHostHeader false em {key}")

# HTTPS router bets → service waba_bets_pv-1 (padrão Easypanel, igual paginadevendas)
pat_https = r'("https-[^"]*bets[_-]pv[^"]*"\s*:\s*\{[\s\S]*?"service"\s*:\s*")[^"]+(")'
text, n = re.subn(pat_https, r'\g<1>waba_bets_pv-1\2', text, flags=re.I)
if n:
    print(f"https router -> waba_bets_pv-1 ({n}x)")

# Criar waba_bets_pv-1 se ausente (clonar de -0)
if '"waba_bets_pv-1"' not in text and '"waba_bets_pv-0"' in text:
    m = re.search(r'("waba_bets_pv-0"\s*:\s*\{[\s\S]*?\n      \})', text)
    if m:
        clone = m.group(1).replace('"waba_bets_pv-0"', '"waba_bets_pv-1"', 1)
        text = text[: m.end()] + ",\n      " + clone + text[m.end() :]
        print("criado waba_bets_pv-1 (clone -0)")

path.write_text(text, encoding="utf-8")
print("OK")
PY

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$CID" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 10

code=$(probe)
body=$(curl -sS --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null | head -c 200 || true)
log "depois: https=${code}"
log "body: ${body}"

# Diagnóstico Host header
log "local+Host bet: $(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: bet.waba.info' http://127.0.0.1:30211/ 2>/dev/null || echo 000)"

[[ "$code" =~ ^(200|301|302|304)$ ]] && exit 0
exit 1
