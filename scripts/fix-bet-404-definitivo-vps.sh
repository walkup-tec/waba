#!/bin/bash
# bet.waba.info 404 — força router HTTPS + backend 172.17.0.1:30211 (sem reconcile, sem permanent).
#
# Uso no VPS:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-404-definitivo-vps.sh" -o /tmp/fix-bet.sh
#   sed -i 's/\r$//' /tmp/fix-bet.sh && bash /tmp/fix-bet.sh
#
# Versão: fix-bet-404-definitivo-2026-07-09-v2
set -euo pipefail

VERSION="fix-bet-404-definitivo-2026-07-09-v2"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-404-definitivo.log"
BETS_URL="http://172.17.0.1:30211/"
BETS_EP="waba-bets-pv.achpyp.easypanel.host"
BETS_PUB="bet.waba.info"
BETS_SWARM="waba_bets_pv"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

log "=== $VERSION ==="
[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }

code=$(http_code http://127.0.0.1:30211/)
log "backend local 30211 → $code"
[[ "$code" =~ ^(200|301|302|304)$ ]] || { log "ERRO: waba_bets_pv não responde em :30211"; exit 1; }

cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%H%M%S)"

python3 - "$CFG" "$BETS_URL" "$BETS_EP" "$BETS_PUB" "$BETS_SWARM" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
url = sys.argv[2].rstrip("/") + "/"
bets_ep, bets_pub, bets_swarm = sys.argv[3:6]
text = path.read_text(encoding="utf-8")

RULE = f"(Host(`{bets_ep}`) || Host(`{bets_pub}`)) && PathPrefix(`/`)"
RULE_ESC = re.escape(RULE)

# 1) Remover bet.waba.info de routers que NÃO são bets_pv (contaminação emergency/typebot)
router_key_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = router_key_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
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
    if bets_pub in block and "bets_pv" not in key.lower() and "bets-pv" not in key.lower():
        new_block = block
        new_block = re.sub(rf"\s*\|\|\s*Host\(`{re.escape(bets_pub)}`\)", "", new_block)
        new_block = re.sub(rf"Host\(`{re.escape(bets_pub)}`\)\s*\|\|\s*", "", new_block)
        new_block = new_block.replace(f"Host(`{bets_pub}`)", "")
        if new_block != block:
            print(f"LIMPO {bets_pub} de router {key}")
            text = text[: m.start()] + new_block + text[end:]
            pos = m.start() + len(new_block)
            continue
    pos = end

# 2) Garantir blocos http/https + service waba_bets_pv-0
http_router = f'''
      "http-{bets_swarm}-0": {{
        "entryPoints": [
          "web"
        ],
        "service": "{bets_swarm}-0",
        "rule": "{RULE}",
        "priority": 100
      }}'''

https_router = f'''
      "https-{bets_swarm}-0": {{
        "entryPoints": [
          "websecure"
        ],
        "service": "{bets_swarm}-0",
        "rule": "{RULE}",
        "priority": 100,
        "tls": {{
          "domains": [
            {{
              "main": "{bets_ep}",
              "sans": ["{bets_pub}"]
            }}
          ]
        }}
      }}'''

service_block = f'''
      "{bets_swarm}-0": {{
        "loadBalancer": {{
          "servers": [
            {{
              "url": "{url}"
            }}
          ],
          "passHostHeader": true
        }}
      }}'''

# Atualizar rule em routers bets existentes
for prefix in ("http", "https"):
    pat = rf'("{prefix}-{re.escape(bets_swarm)}[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{RULE}\2", text, flags=re.I)
    if n:
        print(f"rule {prefix}-{bets_swarm} atualizada ({n}x)")

# Criar https router se ausente
if f'"https-{bets_swarm}-0"' not in text and f"https-{bets_swarm}-0" not in text:
    anchor = None
    for cand in (
        f'"https-{bets_swarm}-0"',
        '"https-waba_paginadevendas-0"',
        '"https-typebot_paginadevendas-0"',
        '"https-waba_paginadevendas-0"',
    ):
        if cand.strip('"') in text or cand in text:
            anchor = cand
            break
    if anchor:
        idx = text.find(anchor)
        brace_start = text.find("{", idx)
        depth, end = 0, brace_start
        for i, ch in enumerate(text[brace_start:], brace_start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        text = text[:end] + "," + http_router + "," + https_router + text[end:]
        print(f"CRIADO http/https-{bets_swarm}-0 após {anchor}")
    else:
        print("ERRO: âncora para inserir bets router não encontrada")

# Service waba_bets_pv-0
svc_pat = rf'("{re.escape(bets_swarm)}-0"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
text, n = re.subn(svc_pat, rf"\g<1>{url}\2", text, count=1)
if n:
    print(f"service {bets_swarm}-0 url -> {url}")
elif f'"{bets_swarm}-0"' not in text:
    m = re.search(rf'"{re.escape("waba_paginadevendas")}-0"\s*:\s*\{{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}}', text)
    if m:
        text = text[: m.end()] + "," + service_block + text[m.end() :]
        print(f"CRIADO service {bets_swarm}-0")
    else:
        print("AVISO: não inseriu service — patch manual pode ser necessário")

for old in (
    f"http://tasks.{bets_swarm}:3000/",
    f"http://{bets_swarm}:3000/",
    "http://tasks.waba_bets_pv:3000/",
):
    if old in text and old != url:
        text = text.replace(old, url)
        print(f"replace {old}")

if f"Host(`{bets_pub}`)" not in text:
    print(f"ERRO: {bets_pub} ainda ausente")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("main.yaml bets OK")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 8
log "HUP ${cid:0:12}"

bet=$(http_code --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/)
ep=$(http_code --resolve ${BETS_EP}:443:127.0.0.1 https://${BETS_EP}/)
log "bet.waba.info → $bet"
log "bets EP → $ep"
log "=== fim ==="

[[ "$bet" =~ ^(200|301|302|304)$ ]] || exit 1
