#!/bin/bash
# Corrige AMBAS landings de uma vez — sem replace global (v1 quebrou :30210).
# bet.waba.info → 172.17.0.1:30211 + passHostHeader
# wabadisparos.com.br → 172.17.0.1:30210 + passHostHeader
#
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-landings-both-vps.sh" -o /tmp/fix-landings.sh
#   sed -i 's/\r$//' /tmp/fix-landings.sh && bash /tmp/fix-landings.sh
#
# Versão: fix-landings-both-2026-07-09-v2
set -euo pipefail

VERSION="fix-landings-both-2026-07-09-v2"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-landings-both.log"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }
body_snip() { curl -sS --max-time 12 "$@" 2>/dev/null | tr -d '\0' | head -c 5000 || true; }

log "=== $VERSION ==="

for u in traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer; do
  systemctl disable --now "$u" 2>/dev/null || true
done

for p in 30210 30211; do
  c=$(http_code "http://127.0.0.1:${p}/")
  log "local :${p} -> ${c}"
done

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

PV_URL = "http://172.17.0.1:30210/"
BETS_URL = "http://172.17.0.1:30211/"
PV_PUB = "wabadisparos.com.br"
PV_EP = "waba-paginadevendas.achpyp.easypanel.host"
BETS_PUB = "bet.waba.info"
BETS_EP = "waba-bets-pv.achpyp.easypanel.host"
BETS_SVC = "waba_bets_pv-0"
PV_SVC = "waba_paginadevendas-0"
BETS_RULE = f"(Host(`{BETS_EP}`) || Host(`{BETS_PUB}`)) && PathPrefix(`/`)"
PV_RULE = f"(Host(`{PV_EP}`) || Host(`{PV_PUB}`)) && PathPrefix(`/`)"

router_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)

def extract_block(text: str, start: int):
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return text[start:end], start, end

def set_service_url(block: str, url: str) -> str:
    block = re.sub(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
    if "passHostHeader" not in block:
        block = block.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": true,', 1)
    else:
        block = re.sub(r'"passHostHeader"\s*:\s*(?:true|false)', '"passHostHeader": true', block, count=1)
    return block

# --- Services: patch cirúrgico por família (NUNCA replace global) ---
svc_pat = re.compile(r'"([^"]+)"\s*:\s*\{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}', re.M)
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    kl = key.lower()
    new_block = block
    if "bets" in kl and ("bets_pv" in kl or "bets-pv" in kl):
        new_block = set_service_url(block, BETS_URL)
        print(f"service {key} -> {BETS_URL}")
    elif "paginadevendas" in kl or "pagina-devendas" in kl:
        new_block = set_service_url(block, PV_URL)
        print(f"service {key} -> {PV_URL}")
    if new_block != block:
        text = text[:bstart] + new_block + text[bend:]
        pos = bstart + len(new_block)
    else:
        pos = bend

# --- Remover hosts cruzados ---
def strip_host(block: str, host: str) -> str:
    b = block
    b = re.sub(rf"\s*\|\|\s*Host\(`{re.escape(host)}`\)", "", b)
    b = re.sub(rf"Host\(`{re.escape(host)}`\)\s*\|\|\s*", "", b)
    b = b.replace(f"Host(`{host}`)", "")
    b = re.sub(r"\(\s*\|\|", "(", b)
    b = re.sub(r"\|\|\s*\)", ")", b)
    return b

pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    kl = key.lower()
    nb = block
    is_bets = "bets" in kl and ("bets_pv" in kl or "bets-pv" in kl)
    is_pv = "paginadevendas" in kl
    if not is_bets and BETS_PUB in nb:
        nb = strip_host(nb, BETS_PUB)
        if nb != block:
            print(f"LIMPO {BETS_PUB} de {key}")
    if not is_pv and PV_PUB in nb:
        nb = strip_host(nb, PV_PUB)
        if nb != block:
            print(f"LIMPO {PV_PUB} de {key}")
    if nb != block:
        text = text[:bstart] + nb + text[bend:]
        pos = bstart + len(nb)
        continue
    pos = bend

# --- Routers bets ---
for prefix in ("http", "https"):
    pat = rf'("{prefix}-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{)([\s\S]*?)(\n      \}})'
    def fix_bets(m):
        head, body, tail = m.group(1), m.group(2), m.group(3)
        body = re.sub(r'("rule"\s*:\s*")[^"]+(")', rf'\g<1>{BETS_RULE}\2', body, count=1)
        body = re.sub(r'("service"\s*:\s*")[^"]+(")', rf'\g<1>{BETS_SVC}\2', body, count=1)
        if '"priority"' in body:
            body = re.sub(r'("priority"\s*:\s*)\d+', r'\g<1>1000', body, count=1)
        else:
            body = body.replace('"rule":', '"priority": 1000,\n        "rule":', 1)
        return head + body + tail
    text, n = re.subn(pat, fix_bets, text, flags=re.I)
    if n:
        print(f"router bets {prefix} ({n}x)")

# --- Routers paginadevendas (waba + typebot) ---
for prefix in ("http", "https"):
    pat = rf'("{prefix}-[^"]*paginadevendas[^"]*"\s*:\s*\{{)([\s\S]*?)(\n      \}})'
    def fix_pv(m):
        head, body, tail = m.group(1), m.group(2), m.group(3)
        if PV_PUB not in body and PV_EP not in body:
            return m.group(0)
        body = re.sub(r'("rule"\s*:\s*")[^"]+(")', rf'\g<1>{PV_RULE}\2', body, count=1)
        svc_m = re.search(r'"service"\s*:\s*"([^"]+)"', body)
        if svc_m and "paginadevendas" in svc_m.group(1):
            pass
        elif '"service"' in body:
            body = re.sub(r'("service"\s*:\s*")[^"]+(")', rf'\g<1>{PV_SVC}\2', body, count=1)
        return head + body + tail
    text, n = re.subn(pat, fix_pv, text, flags=re.I)
    if n:
        print(f"router pv {prefix} ({n}x)")

# --- Criar bets se ausente ---
if not re.search(rf'Host\(`{re.escape(BETS_PUB)}`\)', text):
    print("ERRO: bet.waba.info ausente após patch")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print("OK main.yaml")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 10
log "HUP ${cid:0:12}"

pv_code=$(http_code --resolve "wabadisparos.com.br:443:127.0.0.1" https://wabadisparos.com.br/)
bet_code=$(http_code --resolve "bet.waba.info:443:127.0.0.1" https://bet.waba.info/)
bet_body=$(body_snip --resolve "bet.waba.info:443:127.0.0.1" https://bet.waba.info/)
pv_body=$(body_snip --resolve "wabadisparos.com.br:443:127.0.0.1" https://wabadisparos.com.br/)

log "HTTPS disparos=${pv_code} bet=${bet_code}"

ok_bet=0
ok_pv=0
[[ "$bet_code" =~ ^(200|301|302|304)$ ]] && echo "$bet_body" | grep -qi "Bet Waba\|drax-bets\|segmento de Bets" && ok_bet=1
[[ "$pv_code" =~ ^(200|301|302|304)$ ]] && echo "$pv_body" | grep -qi "DRAX WABA\|Disparos de WhatsApp" && ok_pv=1

if [[ "$ok_bet" -eq 1 && "$ok_pv" -eq 1 ]]; then
  log "SUCESSO: ambas landings OK"
  exit 0
fi

log "FALHA: bet_ok=${ok_bet} pv_ok=${pv_pv} (bet_code=${bet_code})"
if echo "$bet_body" | grep -qi "Page not found"; then
  log "bet ainda 404 app — teste direto:"
  log "  curl -H 'Host: bet.waba.info' http://127.0.0.1:30211/ | head -c 200"
fi
grep -n "bet\.waba\|wabadisparos\|30210\|30211\|bets_pv\|paginadevendas" "$CFG" | head -35 | tee -a "$LOG"
exit 1
