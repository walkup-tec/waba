#!/bin/bash
# EMERGÊNCIA bet.waba.info → landing Bet Waba (WABA :30180/bets)
# v2 falhou: path no URL + só patch em bets_pv-0 (HTTPS usa bets_pv-1)
# Versão: bet-emergency-waba-bets-landing-2026-07-09-v4
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/bet-emergency-waba-bets.log"
BETS_PUB="bet.waba.info"
WABA_URL="http://172.17.0.1:30180/"
MW_REPLACE="bet-emergency-replace-bets-path"
MW_REDIRECT="bet-emergency-redirect-bets"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

probe() {
  curl -sS -o /dev/null -w "%{http_code}" --max-time 12 \
    --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null || echo "000"
}

probe_body() {
  curl -sS --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/" 2>/dev/null | head -c 1200 || true
}

ok_landing() {
  local code body
  code=$(probe)
  body=$(probe_body)
  [[ "$code" =~ ^(200|301|302|304)$ ]] && echo "$body" | grep -qiE 'Bet Waba|Disparo de WhatsApp em larga escala para Bets'
}

log "=== bet-emergency v4 ==="

for u in traefik-permanent-bets-pv-fix.timer traefik-permanent-bets-pv-watch.service \
  traefik-easypanel-config-guard.service; do
  systemctl disable --now "$u" 2>/dev/null || true
done

curl -sf -m 8 "http://127.0.0.1:30180/bets" | grep -qi "Bet Waba" \
  || { log "ERRO: http://127.0.0.1:30180/bets indisponível"; exit 1; }

if ! ss -tln | grep -q ':443 '; then
  curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-easypanel-bootstrap-vps.sh" -o /tmp/tr-bootstrap.sh
  sed -i 's/\r$//' /tmp/tr-bootstrap.sh && bash /tmp/tr-bootstrap.sh run || true
  sleep 10
fi

cp -a "$CFG" "${CFG}.bak-bet-emergency-v4-$(date +%s)"

apply_patch() {
  local mode="${1:-replace}"
  python3 - "$CFG" "$WABA_URL" "$MW_REPLACE" "$MW_REDIRECT" "$mode" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
waba_url = sys.argv[2].rstrip("/") + "/"
mw_replace = sys.argv[3]
mw_redirect = sys.argv[4]
mode = sys.argv[5]
text = path.read_text(encoding="utf-8")

mw_replace_block = f'''
      "{mw_replace}": {{
        "replacePath": {{
          "path": "/bets"
        }}
      }}'''

mw_redirect_block = f'''
      "{mw_redirect}": {{
        "redirectRegex": {{
          "regex": "^https?://bet\\\\.waba\\\\.info/(.*)",
          "replacement": "https://waba.draxsistemas.com.br/bets",
          "permanent": false
        }}
      }}'''

def insert_before(anchor: str, block: str) -> None:
    global text
    if anchor not in text:
        return
    idx = text.find(anchor)
    text = text[:idx] + block + ",\n      " + text[idx:]

if f'"{mw_replace}"' not in text:
    for a in ('"waba_bets_pv-0"', '"waba_bets_pv-1"', '"https-waba_bets_pv-0"'):
        if a in text:
            insert_before(a, mw_replace_block)
            print(f"middleware {mw_replace} OK")
            break

if mode == "redirect" and f'"{mw_redirect}"' not in text:
    for a in ('"waba_bets_pv-0"', '"waba_bets_pv-1"', '"https-waba_bets_pv-0"'):
        if a in text:
            insert_before(a, mw_redirect_block)
            print(f"middleware {mw_redirect} OK")
            break

# Todos os services bets_pv (0, 1, 2...)
svc_pat = re.compile(r'"(waba[_-]bets[_-]pv-\d+)"\s*:\s*\{', re.I)
for m in svc_pat.finditer(text):
    key = m.group(1)
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{waba_url}\2", text, count=1)
    if n:
        print(f"service {key} -> {waba_url}")

# passHostHeader false em todos bets services
for m in svc_pat.finditer(text):
    key = m.group(1)
    blk_pat = rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n      \}}'
    bm = re.search(blk_pat, text)
    if not bm:
        continue
    blk = bm.group(0)
    if "passHostHeader" in blk:
        blk2 = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": false', blk, count=1)
    else:
        blk2 = blk.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": false,', 1)
    if blk2 != blk:
        text = text[: bm.start()] + blk2 + text[bm.end() :]

mw_use = mw_redirect if mode == "redirect" else mw_replace

def extract_block(s: str, start: int):
    brace = s.find("{", start)
    depth = 0
    for i, ch in enumerate(s[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1], start, i + 1
    return s[start:], start, len(s)

router_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    block, bstart, bend = extract_block(text, m.start())
    if "bet.waba.info" not in block:
        pos = bend
        continue
    body = block
    if f'"{mw_use}"' not in body:
        if '"middlewares"' in body:
            body = re.sub(
                r'"middlewares"\s*:\s*\[([^\]]*)\]',
                lambda mm: f'"middlewares": [{mm.group(1).strip() + ", " if mm.group(1).strip() else ""}"{mw_use}"]',
                body,
                count=1,
            )
        else:
            body = re.sub(
                r'("service"\s*:\s*"[^"]+",)\n',
                rf'\1\n        "middlewares": ["{mw_use}"],\n',
                body,
                count=1,
            )
    # HTTPS router deve usar service bets_pv-1 se existir
    if "websecure" in body and '"waba_bets_pv-1"' in text:
        body = re.sub(r'("service"\s*:\s*")[^"]+(")', r'\g<1>waba_bets_pv-1\2', body, count=1)
    if body != block:
        print(f"router {m.group(1)} -> middleware {mw_use}")
        text = text[:bstart] + body + text[bend:]
        pos = bstart + len(body)
    else:
        pos = bend

if "Host(`bet.waba.info`)" not in text:
    print("ERRO: Host(bet.waba.info) ausente")
    raise SystemExit(2)

path.write_text(text, encoding="utf-8")
print(f"OK patch mode={mode}")
PY
}

reload_traefik() {
  local cid
  cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
  [[ -n "$cid" ]] || { log "ERRO: Traefik down"; return 1; }
  docker kill -s HUP "$cid" >/dev/null 2>&1 || true
  sleep 12
}

apply_patch replace
reload_traefik

for i in 1 2 3 4 5; do
  code=$(probe)
  log "replacePath tentativa $i: $code"
  ok_landing && { log "OK replacePath"; exit 0; }
  sleep 3
done

log "replacePath falhou — redirect para waba.draxsistemas.com.br/bets"
apply_patch redirect
reload_traefik

for i in 1 2 3 4 5; do
  code=$(probe)
  log "redirect tentativa $i: $code"
  [[ "$code" =~ ^(200|301|302|304)$ ]] && { log "OK redirect"; exit 0; }
  sleep 3
done

grep -n "bet-emergency\|bets_pv\|bet.waba" "$CFG" | head -30 | tee -a "$LOG"
exit 1
