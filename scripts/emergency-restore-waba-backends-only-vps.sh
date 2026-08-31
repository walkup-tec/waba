#!/bin/bash
# EMERGÊNCIA — SÓ WABA (disparos + bet + login). ZERO Sinal Verde.
#
# Para guards SV (para não reescrever de novo) e corrige URLs canônicas.
#
# Cole no VPS:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/emergency-restore-waba-backends-only-vps.sh" \
#     -o /tmp/restore-waba-only.sh
#   sed -i 's/\r$//' /tmp/restore-waba-only.sh
#   bash /tmp/restore-waba-only.sh
#
set -euo pipefail
CFG="${TRAEFIK_CFG:-/etc/easypanel/traefik/config/main.yaml}"
GW="172.17.0.1"

echo "=== parando QUALQUER guard/heal Sinal Verde ==="
systemctl disable --now \
  sinal-verde-overlay-guard.timer \
  sinal-verde-overlay-guard-watch.service \
  sinal-verde-heal.timer \
  sinal-verde-heal-watch.service \
  2>/dev/null || true
rm -f /var/run/sinal-verde-overlay-guard.lock /var/run/heal-sinal-verde-pos-redeploy.lock 2>/dev/null || true

[[ -f "$CFG" ]] || { echo "ERRO: $CFG ausente"; exit 1; }
cp -a "$CFG" "${CFG}.bak-waba-only-$(date +%Y%m%d-%H%M%S)"

python3 - "$CFG" "$GW" <<'PY'
import re, sys
from pathlib import Path

path = Path(sys.argv[1])
gw = sys.argv[2]
text = path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    print("ABORT unbalanced")
    sys.exit(2)

# URLs canônicas — chaves EXATAS de service (nunca http-/https- routers)
EXACT = {
    "waba_paginadevendas-0": f"http://{gw}:30210/",
    "waba_paginadevendas-1": f"http://{gw}:30210/",
    "waba_bets_pv-0": f"http://{gw}:30211/",
    "waba_bets_pv-1": f"http://{gw}:30211/",
    "waba_waba_disparador-0": f"http://{gw}:30180/",
    "waba_waba_disparador-1": f"http://{gw}:30180/",
    "walkup_evo-walkup-api-0": f"http://{gw}:30181/",
    "walkup_evo_walkup-api-0": f"http://{gw}:30181/",
}

def extract_block(text, start):
    brace = text.find("{", start)
    depth, end = 0, brace
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1], start, i + 1
    return text[start:], start, len(text)

nfix = 0
for key, url in EXACT.items():
    token = f'"{key}"'
    pos = 0
    while True:
        idx = text.find(token, pos)
        if idx < 0:
            break
        # só se for "key": {
        m = re.match(rf'"{re.escape(key)}"\s*:\s*\{{', text[idx:])
        if not m:
            pos = idx + len(token)
            continue
        block, bstart, bend = extract_block(text, idx)
        if "loadBalancer" not in block or '"url"' not in block:
            pos = bend
            continue
        nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        if c and nb != block:
            text = text[:bstart] + nb + text[bend:]
            bend = bstart + len(nb)
            nfix += 1
            print(f"{key} -> {url}")
        pos = bend

# Routers: Host público → service loadBalancer correto (bloco a bloco)
HOST_SVC = {
    "wabadisparos.com.br": "waba_paginadevendas-0",
    "bet.waba.info": "waba_bets_pv-0",
    "waba.draxsistemas.com.br": "waba_waba_disparador-0",
}
svc_pat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{', re.M)
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    block, bstart, bend = extract_block(text, m.start())
    rule_m = re.search(r'"rule"\s*:\s*"([^"]+)"', block)
    if not rule_m:
        pos = bend
        continue
    rule = rule_m.group(1)
    nb = block
    for host, svc in HOST_SVC.items():
        if f"Host(`{host}`)" in rule:
            nb2 = re.sub(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{svc}\2", nb, count=1)
            if nb2 != nb:
                print(f"router {m.group(1)} Host({host}) -> {svc}")
                nb = nb2
            break
    if nb != block:
        text = text[:bstart] + nb + text[bend:]
        bend = bstart + len(nb)
        nfix += 1
        pos = bend
    else:
        pos = bend

if text.count("{") != text.count("}"):
    print("ABORT unbalanced after")
    sys.exit(2)

path.write_text(text, encoding="utf-8")
print(f"OK patched={nfix} (Sinal Verde NÃO foi alterado por este script)")
PY

echo "aguardando Traefik file watch ~12s..."
sleep 12

echo "=== validação WABA ==="
for u in \
  "https://wabadisparos.com.br/" \
  "https://bet.waba.info/" \
  "https://waba.draxsistemas.com.br/health"
do
  code=$(curl -sk -o /dev/null -m 14 -w '%{http_code}' "$u" || echo 000)
  echo "$code  $u"
done

echo
echo "Guards Sinal Verde estão DESLIGADOS de propósito."
echo "NÃO rode fix-sv-safe / overlay-guard até eu liberar versão sem regex amplo."
