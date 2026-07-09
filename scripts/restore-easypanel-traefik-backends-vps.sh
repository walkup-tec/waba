#!/bin/bash
# Restaura backends no main.yaml para o formato NATIVO do Easypanel (overlay DNS).
# Corrige contaminação dos scripts waba (paginadevendas apontando para 30180 = tela de login).
#
# Doc Traefik: https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
# Router → service → loadBalancer.servers[].url (deve ser alcançável pela rede do Traefik)
#
# Uso (root@srv1261237):
#   bash /root/restore-easypanel-traefik-backends-vps.sh
#
# Versão: restore-easypanel-backends-2026-07-09-v1
set -euo pipefail

VERSION="restore-easypanel-backends-2026-07-09-v1"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${RESTORE_EP_LOG:-/var/log/restore-easypanel-backends.log}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%Y%m%d-%H%M%S)"

python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# URLs canônicas — iguais ao painel Easypanel (Domínios → serviço:porta interna)
CANONICAL = {
    "waba_paginadevendas": "http://waba_paginadevendas:3000/",
    "waba_bets_pv": "http://waba_bets_pv:3000/",
    "waba_waba_disparador": "http://waba_waba_disparador:80/",
    "waba_waba-disparador": "http://waba_waba_disparador:80/",
    "walkup_evo-walkup-api": "http://walkup_evo-walkup-api:8080/",
    "walkup_evo_walkup-api": "http://walkup_evo-walkup-api:8080/",
}

# 1) Restaurar URL de cada service block por família
for family, url in CANONICAL.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"service {family}* -> {url} ({n}x)")

# 2) wabadisparos NUNCA no router do disparador
for marker in ("disparador", "waba_waba", "waba-waba", "waba.draxsistemas"):
    pat = rf'("https?-[^"]*{re.escape(marker)}[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")([^"]*wabadisparos[^"]*)(")'
    def strip_pv(m: re.Match) -> str:
        rule = m.group(2)
        rule = re.sub(r"\s*\|\|\s*Host\(`wabadisparos\.com\.br`\)", "", rule)
        rule = re.sub(r"Host\(`wabadisparos\.com\.br`\)\s*\|\|\s*", "", rule)
        print(f"removido wabadisparos de router {marker}")
        return m.group(1) + rule + m.group(3)
    text, _ = re.subn(pat, strip_pv, text, flags=re.I)

# 3) Routers Host(wabadisparos) → service paginadevendas-0 (Easypanel)
host_fixes = {
    "wabadisparos.com.br": "waba_paginadevendas-0",
    "waba-paginadevendas.achpyp.easypanel.host": "waba_paginadevendas-0",
    "bet.waba.info": "waba_bets_pv-0",
    "waba-bets-pv.achpyp.easypanel.host": "waba_bets_pv-0",
    "waba.draxsistemas.com.br": "waba_waba_disparador-0",
}

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
    rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', block)
    if rule_m:
        rule = rule_m.group(1)
        for host, svc in host_fixes.items():
            if f"Host(`{host}`)" in rule:
                new_block = re.sub(
                    r'("service"\s*:\s*")[^"]+(")',
                    rf'\g<1>{svc}\2',
                    block,
                    count=1,
                )
                if new_block != block:
                    print(f"router {key} Host({host}) -> service {svc}")
                    text = text[: m.start()] + new_block + text[end:]
                    end = m.start() + len(new_block)
                break
    pos = end

path.write_text(text, encoding="utf-8")
print("OK main.yaml restaurado (formato Easypanel)")
PY

CID=$(docker ps -q -f name=easypanel-traefik -f status=running | head -1)
if [[ -n "$CID" ]]; then
  docker kill -s HUP "$CID" >/dev/null 2>&1 || true
  sleep 5
  log "HUP Traefik ${CID:0:12}"
else
  log "AVISO: Traefik container não encontrado — suba o proxy antes de testar HTTPS"
fi

log "=== validação ==="
curl -sS -o /dev/null -w "wabadisparos: %{http_code}\n" --max-time 15 \
  --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null || echo "wabadisparos: 000"
body=$(curl -sS --max-time 15 --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ 2>/dev/null | head -c 500 || true)
if echo "$body" | grep -q "Acesso WABA"; then
  log "ERRO: ainda serve LOGIN — confira URL em waba_paginadevendas-0 no main.yaml"
elif echo "$body" | grep -qiE "disparos|cadastro|drax-waba-logo"; then
  log "OK: landing paginadevendas"
fi
log "=== ${VERSION} fim ==="
