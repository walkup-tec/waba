#!/bin/bash
# FORÇA backends WABA — chave EXATA, bloco a bloco. Não toca Sinal Verde.
set -euo pipefail
CFG=/etc/easypanel/traefik/config/main.yaml

systemctl disable --now \
  sinal-verde-overlay-guard.timer \
  sinal-verde-overlay-guard-watch.service \
  sinal-verde-heal.timer \
  sinal-verde-heal-watch.service 2>/dev/null || true

cp -a "$CFG" "${CFG}.bak-force-waba-$(date +%s)"

echo "=== URLs WABA ANTES ==="
grep -n 'waba_paginadevendas\|waba_bets_pv\|waba_waba_disparador' "$CFG" | grep -E 'url|"waba_' | head -40

python3 <<'PY'
from pathlib import Path
import re

cfg = Path("/etc/easypanel/traefik/config/main.yaml")
text = cfg.read_text(encoding="utf-8")
assert text.count("{") == text.count("}")

EXACT = {
    "waba_paginadevendas-0": "http://172.17.0.1:30210/",
    "waba_paginadevendas-1": "http://172.17.0.1:30210/",
    "waba_bets_pv-0": "http://172.17.0.1:30211/",
    "waba_bets_pv-1": "http://172.17.0.1:30211/",
    "waba_waba_disparador-0": "http://172.17.0.1:30180/",
    "waba_waba_disparador-1": "http://172.17.0.1:30180/",
}

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1], start, i + 1
    raise RuntimeError("no block")

nfix = 0
found_keys = []
for key, url in EXACT.items():
    needle = f'"{key}"'
    pos = 0
    while True:
        idx = text.find(needle, pos)
        if idx < 0:
            break
        if not re.match(rf"{re.escape(needle)}\s*:\s*\{{", text[idx:]):
            pos = idx + 1
            continue
        block, a, b = extract_block(text, idx)
        found_keys.append(key)
        if "loadBalancer" not in block:
            print(f"SKIP {key} (sem loadBalancer — provavelmente router)")
            pos = b
            continue
        old = re.search(r'"url"\s*:\s*"([^"]+)"', block)
        old_url = old.group(1) if old else "?"
        nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        if c:
            text = text[:a] + nb + text[b:]
            b = a + len(nb)
            nfix += 1
            print(f"FIX {key}: {old_url} -> {url}")
        pos = b

# Também: qualquer url 30310 dentro de blocos cujo NOME da chave começa com waba_paginadevendas / waba_bets
# (caso a chave tenha sufixo diferente)
svc_pat = re.compile(r'"(waba_paginadevendas[^"]*|waba_bets_pv[^"]*|waba_waba_disparador[^"]*)"\s*:\s*\{')
pos = 0
while True:
    m = svc_pat.search(text, pos)
    if not m:
        break
    key = m.group(1)
    if key.startswith("http-") or key.startswith("https-"):
        pos = m.end()
        continue
    block, a, b = extract_block(text, m.start())
    if "loadBalancer" not in block:
        pos = b
        continue
    if "30310" in block or "sinal-verde" in block:
        if key.startswith("waba_paginadevendas"):
            url = "http://172.17.0.1:30210/"
        elif key.startswith("waba_bets_pv"):
            url = "http://172.17.0.1:30211/"
        else:
            url = "http://172.17.0.1:30180/"
        old = re.search(r'"url"\s*:\s*"([^"]+)"', block)
        old_url = old.group(1) if old else "?"
        nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        if c and old_url != url:
            text = text[:a] + nb + text[b:]
            b = a + len(nb)
            nfix += 1
            print(f"FIX-SCAN {key}: {old_url} -> {url}")
    pos = b

# Host routers
HOST = {
    "wabadisparos.com.br": "waba_paginadevendas-0",
    "bet.waba.info": "waba_bets_pv-0",
}
rpat = re.compile(r'"(https?-[^"]+)"\s*:\s*\{')
pos = 0
while True:
    m = rpat.search(text, pos)
    if not m:
        break
    block, a, b = extract_block(text, m.start())
    rule = re.search(r'"rule"\s*:\s*"([^"]+)"', block)
    if not rule:
        pos = b
        continue
    nb = block
    for host, svc in HOST.items():
        if f"Host(`{host}`)" in rule.group(1):
            nb2, c = re.subn(r'("service"\s*:\s*")[^"]+(")', rf"\g<1>{svc}\2", nb, count=1)
            if c and nb2 != nb:
                print(f"ROUTER {m.group(1)} -> {svc}")
                nb = nb2
                nfix += 1
            break
    if nb != block:
        text = text[:a] + nb + text[b:]
        b = a + len(nb)
        pos = b
    else:
        pos = b

assert text.count("{") == text.count("}")
cfg.write_text(text, encoding="utf-8")
print(f"keys_seen={sorted(set(found_keys))}")
print(f"nfix={nfix}")
if nfix == 0:
    print("AVISO: nada alterado — dump chaves waba_*:")
    for m in re.finditer(r'"(waba_[^"]+)"\s*:\s*\{', text):
        print(" ", m.group(1))
PY

echo
echo "=== URLs WABA DEPOIS ==="
grep -n 'waba_paginadevendas\|waba_bets_pv\|waba_waba_disparador' "$CFG" | grep url | head -20

echo "aguardando file watch 12s..."
sleep 12

echo "=== HTTP ==="
curl -sk -o /dev/null -m 14 -w "disparos:%{http_code}\n" https://wabadisparos.com.br/ || echo disparos:000
curl -sk -o /dev/null -m 14 -w "bet:%{http_code}\n" https://bet.waba.info/ || echo bet:000
curl -sk -o /dev/null -m 14 -w "health:%{http_code}\n" https://waba.draxsistemas.com.br/health || echo health:000

echo
echo "Guards SV desligados. NÃO rode script Sinal Verde agora."
