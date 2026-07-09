#!/bin/bash
# EMERGÊNCIA — bet.waba.info 404 do app bets_pv: proxy / → WABA /bets (30180) que já responde 200.
# Versão: bet-emergency-waba-bets-landing-2026-07-09-v1
set -euo pipefail

CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/bet-emergency-waba-bets.log"
MW="bet-waba-landing-prefix"
BETS_PUB="bet.waba.info"
WABA_URL="http://172.17.0.1:30180/"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

log "=== bet emergency landing via WABA /bets ==="
curl -sf -m 8 http://127.0.0.1:30180/bets >/dev/null || { log "ERRO: WABA /bets não responde em 30180"; exit 1; }

cp -a "$CFG" "${CFG}.bak-bet-emergency-$(date +%s)"

python3 - "$CFG" "$MW" "$BETS_PUB" "$WABA_URL" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
mw, host, waba_url = sys.argv[2:5]
text = path.read_text(encoding="utf-8")

mw_block = f'''
    "{mw}": {{
      "addPrefix": {{
        "prefix": "/bets"
      }}
    }}'''

if f'"{mw}"' not in text:
    if '"middlewares"' in text or "middlewares:" in text:
        text = re.sub(
            r'("middlewares"\s*:\s*\{)',
            r"\1" + mw_block + ",",
            text,
            count=1,
        )
        print(f"added middleware {mw}")
    else:
        # Easypanel: injeta seção middlewares antes do primeiro router https-
        m = re.search(r'(\s*)"(https-[^"]+)"\s*:\s*\{', text)
        if m:
            indent = m.group(1)
            ins = f'{indent}"middlewares": {{{mw_block}\n{indent}}},\n'
            text = text[: m.start()] + ins + text[m.start() :]
            print(f"created middlewares section + {mw}")
        else:
            print("ERRO: não achei onde inserir middlewares")
            sys.exit(2)

# Backend bets → WABA prod
for key in ("waba_bets_pv-0", "waba-bets-pv-0"):
    pat = rf'("{re.escape(key)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{waba_url}\2", text, count=1)
    if n:
        print(f"service {key} -> {waba_url}")

# Routers bets: middleware addPrefix + priority alta
router_pat = re.compile(r'"(https?-[^"]*(?:bets[_-]pv|bets_pv)[^"]*)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
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
    if '"middlewares"' not in nb:
        nb = nb.replace(
            '"service":',
            f'"middlewares": [\n          "{mw}"\n        ],\n        "service":',
            1,
        )
    elif f'"{mw}"' not in nb:
        nb = re.sub(
            r'"middlewares"\s*:\s*\[',
            f'"middlewares": [\n          "{mw}",',
            nb,
            count=1,
        )
    if '"priority"' in nb:
        nb = re.sub(r'"priority"\s*:\s*\d+', '"priority": 2000', nb, count=1)
    else:
        nb = nb.replace('"service":', '"priority": 2000,\n        "service":', 1)
    if nb != block:
        print(f"router {m.group(1)} + middleware {mw}")
        text = text[: m.start()] + nb + text[end:]
        pos = m.start() + len(nb)
    else:
        pos = end

# Garantir Host bet no router bets
if f"Host(`{host}`)" not in text:
    print(f"AVISO: {host} ausente no main.yaml")

path.write_text(text, encoding="utf-8")
print("OK")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 8

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/")
log "bet.waba.info -> ${code}"
[[ "$code" =~ ^(200|301|302|304)$ ]] || exit 1
