#!/bin/bash
# bet.waba.info → WABA /bets (30180) — v2 força -0 E -1 (HTTPS usa -1).
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-proxy-waba-bets-vps.sh" -o /tmp/fix-bet-proxy.sh
#   sed -i 's/\r$//' /tmp/fix-bet-proxy.sh && bash /tmp/fix-bet-proxy.sh
#
# Versão: fix-bet-proxy-waba-bets-2026-07-09-v2
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-proxy-waba-bets.log"
WABA_URL="http://172.17.0.1:30180/"
MW="bet-waba-to-bets-path"
BETS_PUB="bet.waba.info"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
probe() { curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "https://${BETS_PUB}/" 2>/dev/null || echo "000"; }

log "=== fix-bet-proxy-waba-bets v2 ==="

curl -sf -m 6 "http://127.0.0.1:30180/bets" | grep -q "Bet Waba" \
  || { log "ERRO: :30180/bets sem landing Bet Waba"; exit 1; }

cp -a "$CFG" "${CFG}.bak-bet-proxy-v2-$(date +%s)"

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
        print("ERRO: waba_bets_pv-0 ausente")
        sys.exit(2)
    text = text[:idx] + mw_block + "\n      " + text[idx:]
    print(f"middleware {mw} OK")

svc_tpl = f'''      "SERVICE_KEY": {{
        "loadBalancer": {{
          "servers": [{{ "url": "{waba_url}" }}],
          "passHostHeader": false
        }}
      }}'''

def upsert_service(key: str) -> None:
    global text
    block = svc_tpl.replace("SERVICE_KEY", key)
    pat = rf'"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n      \}},?'
    if re.search(pat, text):
        text, n = re.subn(pat, block.rstrip(",") + ",", text, count=1)
        print(f"service {key} -> {waba_url} ({n})")
    else:
        anchor = text.find('"waba_bets_pv-0"')
        if anchor < 0:
            print(f"ERRO: não criou {key}")
            return
        brace = text.find("{", anchor)
        depth, end = 0, brace
        for i, ch in enumerate(text[brace:], brace):
            if ch == "{": depth += 1
            elif ch == "}": 
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        text = text[:end] + ",\n" + block + text[end:]
        print(f"service {key} CRIADO -> {waba_url}")

upsert_service("waba_bets_pv-0")
upsert_service("waba_bets_pv-1")

def fix_router(m):
    head, body, tail = m.group(1), m.group(2), m.group(3)
    body = re.sub(r'("service"\s*:\s*")[^"]+(")', r'\g<1>waba_bets_pv-0\2', body, count=1)
    if f'"{mw}"' not in body:
        if '"middlewares"' in body:
            body = re.sub(
                r'"middlewares"\s*:\s*\[([^\]]*)\]',
                lambda mm: f'"middlewares": [{mm.group(1).strip() + ", " if mm.group(1).strip() else ""}"{mw}"]',
                body, count=1,
            )
        else:
            body = re.sub(
                r'("service"\s*:\s*"[^"]+",)\n',
                rf'\1\n        "middlewares": ["{mw}"],\n',
                body, count=1,
            )
    return head + body + tail

pat = r'("https?-[^"]*bets[_-]pv[^"]*"\s*:\s*\{)([\s\S]*?)(\n      \})'
text, n = re.subn(pat, fix_router, text, flags=re.I)
print(f"routers bets + middleware ({n})")

if text.count("{") != text.count("}"):
    print("ERRO: chaves desbalanceadas")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("OK")
PY

grep -A12 '"https-waba_bets_pv' "$CFG" | head -20 | tee -a "$LOG"
grep -A6 '"waba_bets_pv-1"' "$CFG" | head -12 | tee -a "$LOG"

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$CID" ]] || { log "ERRO: Traefik down"; exit 1; }
touch "$CFG"
docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 12

code=$(probe)
body=$(curl -sS --max-time 15 "https://${BETS_PUB}/" 2>/dev/null | head -c 150 || true)
log "PRODUÇÃO ${BETS_PUB} -> ${code}"
log "body: ${body}"

if echo "$body" | grep -q "Bet Waba"; then
  log "OK: landing Bet Waba"
  exit 0
fi

# Fallback: redirect 302 para waba.draxsistemas.com.br/bets
log "replacePath falhou — redirect 302"
python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
rd = "bet-waba-redirect-bets"
rd_block = f'''      "{rd}": {{
        "redirectRegex": {{
          "regex": "^https?://bet\\\\.waba\\\\.info/(.*)",
          "replacement": "https://waba.draxsistemas.com.br/bets",
          "permanent": false
        }}
      }},'''
if f'"{rd}"' not in text:
    idx = text.find('"waba_bets_pv-0"')
    text = text[:idx] + rd_block + "\n      " + text[idx:]
pat = r'("https-[^"]*bets[_-]pv[^"]*"\s*:\s*\{)([\s\S]*?)(\n      \})'
def fix(m):
    body = m.group(2)
    body = re.sub(r'"middlewares"\s*:\s*\[[^\]]*\]', f'"middlewares": ["{rd}"]', body, count=1)
    if '"middlewares"' not in body:
        body = re.sub(r'("service"\s*:\s*"[^"]+",)\n', rf'\1\n        "middlewares": ["{rd}"],\n', body, count=1)
    return m.group(1) + body + m.group(3)
text = re.sub(pat, fix, text, count=1, flags=re.I)
path.write_text(text, encoding="utf-8")
print("redirect OK")
PY

docker kill -s HUP "$CID" >/dev/null 2>&1 || true
sleep 10
code=$(probe)
log "PRODUÇÃO após redirect -> ${code}"
[[ "$code" =~ ^(200|301|302|304)$ ]] && exit 0
exit 1
