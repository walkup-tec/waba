#!/bin/bash
# bet.waba.info → backend ERRADO (paginadevendas :30210) devolve 404 do app React DRAX.
# Este script força service waba_bets_pv-0 + URL 172.17.0.1:30211 e remove Host de routers errados.
#
# Uso no VPS:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-bet-route-30211-vps.sh" -o /tmp/fix-bet-route.sh
#   sed -i 's/\r$//' /tmp/fix-bet-route.sh && bash /tmp/fix-bet-route.sh
#
# Versão: fix-bet-route-30211-2026-07-09-v2
set -euo pipefail

VERSION="fix-bet-route-30211-2026-07-09-v2"
CFG="/etc/easypanel/traefik/config/main.yaml"
LOG="/var/log/fix-bet-route-30211.log"
BETS_PUB="bet.waba.info"
BETS_EP="waba-bets-pv.achpyp.easypanel.host"
BETS_SVC="waba_bets_pv-0"
BETS_URL="http://172.17.0.1:30211/"
RULE="(Host(\`${BETS_EP}\`) || Host(\`${BETS_PUB}\`)) && PathPrefix(\`/\`)"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }
http_code() { curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "$@" 2>/dev/null || echo "000"; }

body_marker() {
  curl -sS --max-time 12 "$@" 2>/dev/null | tr -d '\0' | head -c 5000 || true
}

log "=== $VERSION ==="

# Parar scripts que recontaminam
for u in \
  traefik-easypanel-config-guard.service \
  traefik-permanent-paginadevendas-fix.timer \
  traefik-permanent-bets-pv-fix.timer \
  traefik-permanent-waba-fix.timer; do
  systemctl disable --now "$u" 2>/dev/null || true
done

local_code=$(http_code http://127.0.0.1:30211/)
pv_code=$(http_code http://127.0.0.1:30210/)
log "local 30211=$local_code 30210=$pv_code"

[[ "$local_code" =~ ^(200|301|302|304)$ ]] || {
  log "ERRO: :30211 não responde — redeploy waba_bets_pv no Easypanel"
  exit 1
}

local_body=$(body_marker -H "Host: ${BETS_PUB}" http://127.0.0.1:30211/)
if echo "$local_body" | grep -qi "Bet Waba\|drax-bets\|segmento de Bets"; then
  log "OK: :30211 serve landing Bets"
elif echo "$local_body" | grep -qi "DRAX WABA\|wabadisparos"; then
  log "AVISO: :30211 parece app paginadevendas — verifique deploy bets_pv no Easypanel"
else
  log "AVISO: corpo :30211 não reconhecido (primeiros 120 chars): $(echo "$local_body" | tr -d '\n' | head -c 120)"
fi

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%s)"

python3 - "$CFG" "$BETS_PUB" "$BETS_EP" "$BETS_SVC" "$BETS_URL" "$RULE" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
bets_pub, bets_ep, bets_svc, bets_url, rule = sys.argv[2:7]
text = path.read_text(encoding="utf-8")

router_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)

def extract_block(text: str, start: int) -> tuple[str, int, int]:
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

# --- Diagnóstico: quem tem bet.waba.info? ---
pos = 0
hits = []
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    block, bstart, bend = extract_block(text, m.start())
    if bets_pub in block:
        svc_m = re.search(r'"service"\s*:\s*"([^"]+)"', block)
        rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', block)
        hits.append((m.group(1), svc_m.group(1) if svc_m else "?", rule_m.group(1)[:80] if rule_m else "?"))
    pos = bend

print("ROUTERS com bet.waba.info ANTES do patch:")
for k, svc, r in hits:
    print(f"  {k} -> service={svc} rule={r}")

# --- 1) Remover bet.waba.info de routers que NÃO devem servir bets ---
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    kl = key.lower()
    is_bets_router = "bets" in kl and ("bets_pv" in kl or "bets-pv" in kl)
    if bets_pub in block and not is_bets_router:
        nb = block
        nb = re.sub(rf"\s*\|\|\s*Host\(`{re.escape(bets_pub)}`\)", "", nb)
        nb = re.sub(rf"Host\(`{re.escape(bets_pub)}`\)\s*\|\|\s*", "", nb)
        nb = nb.replace(f"Host(`{bets_pub}`)", "")
        nb = re.sub(r"\(\s*\|\|", "(", nb)
        nb = re.sub(r"\|\|\s*\)", ")", nb)
        if nb != block:
            print(f"REMOVIDO {bets_pub} de router {key}")
            text = text[:bstart] + nb + text[bend:]
            pos = bstart + len(nb)
            continue
    pos = bend

# --- 2) Qualquer router bets: rule + service corretos ---
for prefix in ("http", "https"):
    pat = rf'("{prefix}-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{)([\s\S]*?)(\n\s*\}})'
    def fix_bets_router(m: re.Match) -> str:
        head, body, tail = m.group(1), m.group(2), m.group(3)
        body = re.sub(r'("rule"\s*:\s*")[^"]+(")', rf"\g<1>{rule}\2", body, count=1)
        body = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{bets_svc}\2", body, count=1)
        if '"priority"' in body:
            body = re.sub(r'("priority"\s*:\s*)\d+', r"\g<1>1000", body, count=1)
        else:
            body = body.replace('"rule":', '"priority": 1000,\n        "rule":', 1)
        return head + body + tail
    text, n = re.subn(pat, fix_bets_router, text, flags=re.I)
    if n:
        print(f"PATCH routers {prefix}-bets ({n}x)")

# --- 3) Se router com bet ainda aponta service errado, corrigir ---
pos = 0
while True:
    m = router_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    block, bstart, bend = extract_block(text, m.start())
    if bets_pub in block:
        wrong = re.search(r'"service"\s*:\s*"([^"]+)"', block)
        if wrong and wrong.group(1) != bets_svc:
            nb = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{bets_svc}\2", block, count=1)
            print(f"FIX service {key}: {wrong.group(1)} -> {bets_svc}")
            text = text[:bstart] + nb + text[bend:]
            pos = bstart + len(nb)
            continue
    pos = bend

# --- 4) Service waba_bets_pv-0 -> 30211 ---
for sk in (bets_svc, "waba-bets-pv-0"):
    pat = rf'("{re.escape(sk)}"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{bets_url}\2", text, count=1)
    if n:
        print(f"service {sk} url -> {bets_url}")

for old in (
    "http://tasks.waba_bets_pv:3000/",
    "http://waba_bets_pv:3000/",
    "http://127.0.0.1:30211/",
):
    m = re.search(rf'"{re.escape(bets_svc)}"\s*:\s*\{{[\s\S]*?\n      \}}', text)
    if m and old in m.group(0):
        nb = m.group(0).replace(old, bets_url)
        text = text[: m.start()] + nb + text[m.end() :]
        print(f"replace in {bets_svc}: {old}")

# passHostHeader obrigatório no service bets
m = re.search(rf'"{re.escape(bets_svc)}"\s*:\s*\{{[\s\S]*?\n      \}}', text)
if m:
    blk = m.group(0)
    if "passHostHeader" not in blk:
        nb = blk.replace('"loadBalancer": {', '"loadBalancer": {\n          "passHostHeader": true,', 1)
        text = text[: m.start()] + nb + text[m.end() :]
        print("passHostHeader true em waba_bets_pv-0")
    else:
        nb = re.sub(r'"passHostHeader"\s*:\s*false', '"passHostHeader": true', blk)
        if nb != blk:
            text = text[: m.start()] + nb + text[m.end() :]
            print("passHostHeader corrigido")

# --- 5) Criar blocos se não existir router HTTPS com bet ---
has_https = bool(
    re.search(
        rf'"https-[^"]*(?:bets[_-]pv|bets_pv)[^"]*"\s*:\s*\{{[\s\S]*?Host\(`{re.escape(bets_pub)}`\)',
        text,
        re.I,
    )
)
if not has_https:
    http_router = f'''
      "http-waba_bets_pv-0": {{
        "entryPoints": ["web"],
        "service": "{bets_svc}",
        "rule": "{rule}",
        "priority": 1000
      }}'''
    https_router = f'''
      "https-waba_bets_pv-0": {{
        "entryPoints": ["websecure"],
        "service": "{bets_svc}",
        "rule": "{rule}",
        "priority": 1000,
        "tls": {{
          "domains": [{{"main": "{bets_ep}", "sans": ["{bets_pub}"]}}]
        }}
      }}'''
    service_block = f'''
      "{bets_svc}": {{
        "loadBalancer": {{
          "servers": [{{"url": "{bets_url}"}}],
          "passHostHeader": true
        }}
      }}'''
    anchor = None
    for cand in ('"https-typebot_paginadevendas-0"', '"https-waba_paginadevendas-0"'):
        if cand in text:
            anchor = cand
            break
    if anchor:
        qidx = text.find(anchor)
        _, bstart, bend = extract_block(text, qidx)
        text = text[:bend] + "," + http_router + "," + https_router + text[bend:]
        print(f"CRIADO http/https-waba_bets_pv-0 após {anchor}")
    if f'"{bets_svc}"' not in text:
        m = re.search(r'"waba_paginadevendas-0"\s*:\s*\{[\s\S]*?"loadBalancer"[\s\S]*?\n      \}', text)
        if m:
            text = text[: m.end()] + "," + service_block + text[m.end() :]
            print(f"CRIADO service {bets_svc}")

path.write_text(text, encoding="utf-8")
print("main.yaml patched")
PY

cid=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
[[ -n "$cid" ]] || { log "ERRO: Traefik down"; exit 1; }
docker kill -s HUP "$cid" >/dev/null 2>&1 || true
sleep 8
log "HUP ${cid:0:12}"

bet_code=$(http_code --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/")
bet_body=$(body_marker --resolve "${BETS_PUB}:443:127.0.0.1" "https://${BETS_PUB}/")
log "HTTPS bet.waba.info -> $bet_code"

if [[ "$bet_code" =~ ^(200|301|302|304)$ ]] && echo "$bet_body" | grep -qi "Bet Waba\|drax-bets\|segmento de Bets"; then
  log "SUCESSO: bet HTTP ${bet_code} + landing Bets"
  exit 0
fi

if echo "$bet_body" | grep -qi "Bet Waba\|drax-bets\|segmento de Bets"; then
  log "AVISO: corpo Bets mas HTTP ${bet_code} — app pode precisar redeploy"
fi

if echo "$bet_body" | grep -qi "Page not found"; then
  log "FALHA: ainda cai no app paginadevendas (backend errado no Traefik)"
  log "Cole no chat:"
  grep -n "bet\.waba\|bets_pv\|paginadevendas" "$CFG" | head -30 | tee -a "$LOG"
  exit 1
fi

if [[ "$bet_code" =~ ^(200|301|302|304)$ ]]; then
  log "HTTP $bet_code (corpo não validado)"
  exit 0
fi

log "FALHA: HTTP $bet_code"
exit 1
