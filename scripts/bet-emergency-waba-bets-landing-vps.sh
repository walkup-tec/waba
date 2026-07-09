#!/bin/bash
# EMERGÊNCIA — bet.waba.info → WABA /bets (30180) via replacePath no router.
# Path no server URL NÃO reescreve / → /bets neste Traefik/Easypanel (causa 404).
# Versão: bet-emergency-waba-bets-landing-2026-07-09-v3
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/bet-emergency-waba-bets.log"
BETS_PUB="bet.waba.info"
WABA_URL="http://172.17.0.1:30180/"
MW_NAME="bet-emergency-replace-bets-path"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== bet-emergency v3 (replacePath → /bets) ==="

for u in traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service \
  traefik-easypanel-config-guard.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done

curl -sf -m 8 "http://127.0.0.1:30180/bets" | grep -q "Bet Waba" \
  || { log "ERRO: /bets em 30180 não retorna landing Bet Waba"; exit 1; }

if ! ss -tln | grep -q ':443 '; then
  log "Traefik :443 down — bootstrap"
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-easypanel-bootstrap-vps.sh" -o /tmp/tr-bootstrap.sh
  sed -i 's/\r$//' /tmp/tr-bootstrap.sh && bash /tmp/tr-bootstrap.sh run || true
  sleep 10
fi

cp -a "$CFG" "${CFG}.bak-bet-emergency-v3-$(date +%s)"

python3 <<PY
import re
from pathlib import Path

cfg = Path("${CFG}")
waba_url = "${WABA_URL}"
mw_name = "${MW_NAME}"
text = cfg.read_text(encoding="utf-8")

mw_block = f'''
      "{mw_name}": {{
        "replacePath": {{
          "path": "/bets"
        }}
      }}'''

# --- middleware replacePath ---
if f'"{mw_name}"' not in text:
    anchor = '"waba_bets_pv-0"'
    if anchor not in text:
        anchor = '"https-waba_bets_pv-0"'
    if anchor not in text:
        print("ERRO: âncora bets ausente no main.yaml")
        raise SystemExit(2)
    idx = text.find(anchor)
    text = text[:idx] + mw_block + ",\n      " + text[idx:]
    print(f"middleware {mw_name} inserido")

# --- services bets → WABA 30180 (sem path no URL) ---
for key in ("waba_bets_pv-0", "waba_bets_pv-1", "waba-bets-pv-0"):
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{waba_url}\2", text, count=1)
    if n:
        print(f"service {key} -> {waba_url}")
        m = re.search(rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n      \}}', text)
        if m:
            blk = m.group(0)
            if "passHostHeader" in blk:
                blk2 = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": false', blk, count=1)
            else:
                blk2 = blk.replace(
                    '"loadBalancer": {',
                    '"loadBalancer": {\n          "passHostHeader": false,',
                    1,
                )
            if blk2 != blk:
                text = text[: m.start()] + blk2 + text[m.end() :]
                print(f"passHostHeader false em {key}")

# --- routers bets: middleware replacePath ---
router_pat = re.compile(r'"(https?-[^"]*(?:bets[_-]pv|bets_pv)[^"]*)"\s*:\s*\{', re.I)

def extract_block(s: str, start: int):
    brace = s.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(s[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1], start, i + 1
    return s[start:], start, len(s)

pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    block, bstart, bend = extract_block(text, m.start())
    body = block
    if f'"{mw_name}"' not in body:
        if '"middlewares"' in body:
            body = re.sub(
                r'"middlewares"\s*:\s*\[([^\]]*)\]',
                lambda mm: f'"middlewares": [{mm.group(1).strip() + ", " if mm.group(1).strip() else ""}"{mw_name}"]',
                body,
                count=1,
            )
        else:
            body = re.sub(
                r'("service"\s*:\s*"[^"]+",)\n',
                rf'\1\n        "middlewares": ["{mw_name}"],\n',
                body,
                count=1,
            )
    if body != block:
        print(f"router {m.group(1)} + middleware {mw_name}")
        text = text[:bstart] + body + text[bend:]
        pos = bstart + len(body)
    else:
        pos = bend

if "Host(`bet.waba.info`)" not in text:
    print("ERRO: Host(bet.waba.info) ausente")
    raise SystemExit(2)

cfg.write_text(text, encoding="utf-8")
print("OK main.yaml")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 12

for i in 1 2 3 4 5; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
    --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null || echo "000")
  body=$(curl -sS --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null | head -c 800 || true)
  log "tentativa $i: ${code}"
  if [[ "$code" =~ ^(200|301|302|304)$ ]] && echo "$body" | grep -q "Bet Waba"; then
    log "OK: landing Bet Waba via WABA /bets"
    exit 0
  fi
  sleep 3
done
log "FALHA — grep debug:"
grep -n "bet-emergency\|bets_pv\|bet.waba" "$CFG" | head -25 | tee -a "$LOG" || true
exit 1
