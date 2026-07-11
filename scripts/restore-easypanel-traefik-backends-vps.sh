#!/bin/bash
# Ajusta backends no main.yaml para o que FUNCIONA neste VPS:
#   http://172.17.0.1:<porta_host>/  (publish host)
# Overlay DNS (waba_paginadevendas:3000) costuma dar 502 — Traefik não alcança.
#
# Doc: https://doc.traefik.io/traefik/reference/routing-configuration/http/load-balancing/service/
# File provider watch: https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#
# NÃO usa HUP (neste VPS HUP derruba :443).
#
# Uso:
#   bash /root/restore-easypanel-traefik-backends-vps.sh
#
# Versão: restore-easypanel-backends-2026-07-10-v2
set -euo pipefail

VERSION="restore-easypanel-backends-2026-07-10-v2"
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
LOG="${RESTORE_EP_LOG:-/var/log/restore-easypanel-backends.log}"
HOST_GW="${WABA_HOST_GW:-172.17.0.1}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" | tee -a "$LOG"; }

[[ -f "$CFG" ]] || { log "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-${VERSION}-$(date +%Y%m%d-%H%M%S)"

python3 - "$CFG" "$HOST_GW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
gw = sys.argv[2]
text = path.read_text(encoding="utf-8")

# Host gateway — portas publicadas neste VPS (não overlay DNS)
CANONICAL = {
    "waba_paginadevendas": f"http://{gw}:30210/",
    "waba_bets_pv": f"http://{gw}:30211/",
    "waba_waba_disparador": f"http://{gw}:30180/",
    "waba_waba-disparador": f"http://{gw}:30180/",
    "walkup_evo-walkup-api": f"http://{gw}:30181/",
    "walkup_evo_walkup-api": f"http://{gw}:30181/",
}

for family, url in CANONICAL.items():
    pat = rf'("(?:[^"]*{re.escape(family)}[^"]*)"\s*:\s*\{{[\s\S]*?"url"\s*:\s*")[^"]+(")'
    text, n = re.subn(pat, rf"\g<1>{url}\2", text, flags=re.I)
    if n:
        print(f"service {family}* -> {url} ({n}x)")

# wabadisparos NUNCA no router do disparador
for marker in ("disparador", "waba_waba", "waba-waba", "waba.draxsistemas"):
    pat = rf'("https?-[^"]*{re.escape(marker)}[^"]*"\s*:\s*\{{[\s\S]*?"rule"\s*:\s*")([^"]*wabadisparos[^"]*)(")'
    def strip_pv(m: re.Match) -> str:
        rule = m.group(2)
        rule = re.sub(r"\s*\|\|\s*Host\(`wabadisparos\.com\.br`\)", "", rule)
        rule = re.sub(r"Host\(`wabadisparos\.com\.br`\)\s*\|\|\s*", "", rule)
        print(f"removido wabadisparos de router {marker}")
        return m.group(1) + rule + m.group(3)
    text, _ = re.subn(pat, strip_pv, text, flags=re.I)

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
print("OK main.yaml backends = host gateway (sem overlay DNS)")
PY

log "=== ${VERSION} — aguardando file watch (~12s), SEM HUP ==="
sleep 12

log "=== validação ==="
for u in \
  "https://wabadisparos.com.br/" \
  "https://bet.waba.info/" \
  "https://waba.draxsistemas.com.br/health"
do
  code=$(curl -sk -o /dev/null -m 12 -w '%{http_code}' "$u" || true)
  echo "${code}  ${u}" | tee -a "$LOG"
done
log "=== ${VERSION} fim ==="
