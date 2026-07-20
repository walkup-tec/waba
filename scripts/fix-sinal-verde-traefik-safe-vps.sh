#!/bin/bash
# Fix Sinal Verde — v4 ISOLADO.
# - NÃO imprime status WABA
# - NÃO usa regex que atravessa blocos do yaml
# - NÃO instala guard automaticamente (só sob comando explícito)
# - Só altera services sinal-verde_acesso-sinalverde-0/1
set -euo pipefail
VERSION="fix-sinal-verde-safe-2026-07-20-v4-isolated"
CFG="/etc/easypanel/traefik/config/main.yaml"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
URL="http://172.17.0.1:30310/"
DOMAIN="acesso-sinalverde.com"

[[ "$(id -u)" -eq 0 ]] || exit 1
echo "[$VERSION] só Sinal Verde"

# publish
if docker service ls --format '{{.Name}}' | grep -qx "$CRM"; then
  ports=$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' || echo '[]')
  if ! echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    echo "publish :${HOST_PORT}"
    docker service update --publish-rm "${HOST_PORT}" "$CRM" >/dev/null 2>&1 || true
    timeout 90 docker service update \
      --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
      "$CRM" || true
    sleep 5
  fi
fi
echo -n "local :${HOST_PORT} "; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 8 "http://127.0.0.1:${HOST_PORT}/" || echo 000

cp -a "$CFG" "${CFG}.bak-sv-isolated-$(date +%s)"
python3 - "$CFG" "$URL" <<'PY'
import re, sys
from pathlib import Path
path, url = Path(sys.argv[1]), sys.argv[2]
text = path.read_text(encoding="utf-8")
assert text.count("{") == text.count("}")

def extract_block(text, start):
    brace = text.find("{", start)
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1], start, i+1
    raise RuntimeError("block")

n = 0
for key in ("sinal-verde_acesso-sinalverde-0", "sinal-verde_acesso-sinalverde-1"):
    idx = 0
    while True:
        pos = text.find(f'"{key}"', idx)
        if pos < 0: break
        if not re.match(rf'"{re.escape(key)}"\s*:\s*\{{', text[pos:]):
            idx = pos + 1
            continue
        block, a, b = extract_block(text, pos)
        if "loadBalancer" not in block:
            idx = b
            continue
        nb, c = re.subn(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
        if c and nb != block:
            text = text[:a] + nb + text[b:]
            b = a + len(nb)
            n += 1
            print(f"{key} -> {url}")
        idx = b
assert text.count("{") == text.count("}")
# garantia: não gravar se landings ficaram com 30310 nas chaves WABA
for wk in ("waba_paginadevendas-0", "waba_bets_pv-0"):
    p = text.find(f'"{wk}"')
    if p >= 0 and re.match(rf'"{re.escape(wk)}"\s*:\s*\{{', text[p:]):
        block, _, _ = extract_block(text, p)
        if "30310" in block:
            print(f"ABORT: {wk} contém 30310 — não grava")
            sys.exit(3)
path.write_text(text, encoding="utf-8")
print(f"patched={n}")
PY

sleep 10
echo -n "sv "; curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 "https://${DOMAIN}/" || echo 000
echo "OK — WABA não foi alterado por este script."
