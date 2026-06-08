#!/bin/bash
# Restaura routers/serviço WABA no Traefik quando Easypanel remove waba.draxsistemas do main.yaml.
# Uso: bash restore-waba-traefik-router-vps.sh
set -euo pipefail

CFG=/etc/easypanel/traefik/config/main.yaml
HOST="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
BACKEND="${WABA_BACKEND_URL:-http://172.17.0.1:30180/}"
BACKEND="${BACKEND%/}/"

[[ -f "$CFG" ]] || { echo "ERRO: $CFG não existe"; exit 1; }

if grep -q "Host(\`${HOST}\`)" "$CFG" 2>/dev/null; then
  echo "OK: router ${HOST} já existe — só ajustando URL do backend"
  python3 - "$CFG" "$BACKEND" <<'PY'
import re, sys
path, backend = sys.argv[1:3]
text = open(path, encoding="utf-8").read()
pat = re.compile(
    r'("waba_waba_disparador-0"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")',
    re.I,
)
text, n = pat.subn(rf"\g<1>{backend}\2", text, count=1)
open(path, "w", encoding="utf-8").write(text)
print(f"  url atualizada ({n}x)")
PY
else
  BAK=""
  for f in $(ls -t /etc/easypanel/traefik/config/main.yaml.bak* 2>/dev/null); do
    if grep -q "Host(\`${HOST}\`)" "$f" 2>/dev/null; then
      BAK="$f"
      break
    fi
  done
  if [[ -z "$BAK" ]]; then
    echo "ERRO: nenhum backup com ${HOST} em /etc/easypanel/traefik/config/"
    echo "  Recrie o domínio no Easypanel → waba → waba_disparador → Domínios"
    exit 1
  fi
  echo "Restaurando de backup: $BAK"
  cp -a "$CFG" "${CFG}.bak-before-restore-$(date +%Y%m%d-%H%M%S)"
  python3 - "$CFG" "$BAK" "$HOST" "$BACKEND" <<'PY'
import json, re, sys

cfg_path, bak_path, host, backend = sys.argv[1:5]
backend = backend.rstrip("/") + "/"

def load(path):
    return open(path, encoding="utf-8").read()

def dump(path, text):
    open(path, "w", encoding="utf-8").write(text)

current = load(cfg_path)
bak = load(bak_path)

keys = [
    "http-waba_waba_disparador-0",
    "https-waba_waba_disparador-0",
    "waba_waba_disparador-0",
]

def extract_block(text, key):
    m = re.search(
        rf'(\s*"{re.escape(key)}"\s*:\s*\{{)',
        text,
    )
    if not m:
        return None
    start = m.start()
    i = m.end()
    depth = 1
    while i < len(text) and depth > 0:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return text[start:i]

blocks = {}
for key in keys:
    blk = extract_block(bak, key)
    if blk:
        blocks[key] = blk
        print(f"  backup: {key} OK")
    else:
        print(f"  backup: {key} AUSENTE")

if "waba_waba_disparador-0" not in blocks:
    sys.exit("serviço waba_waba_disparador-0 não encontrado no backup")

svc = blocks["waba_waba_disparador-0"]
svc = re.sub(
    r'("url"\s*:\s*")[^"]+(")',
    rf"\g<1>{backend}\2",
    svc,
    count=1,
)
blocks["waba_waba_disparador-0"] = svc

for key in list(blocks.keys()):
    if key == "waba_waba_disparador-0":
        continue
    pat = rf'\s*"{re.escape(key)}"\s*:\s*\{{[\s\S]*?\n\s*\}},?'
    current, n = re.subn(pat, "", current, count=1)
    if n:
        print(f"  removido bloco antigo {key}")

insert_at = current.rfind("\n")
chunk = "\n".join(blocks[k] for k in keys if k in blocks) + "\n"
# Inserir antes do fechamento do JSON raiz — procura último bloco "services" / "routers"
if '"routers"' in current and '"http-waba_waba_disparador-0"' not in current:
    # append router entries inside routers object (antes do fechamento de services)
    for key in ("http-waba_waba_disparador-0", "https-waba_waba_disparador-0"):
        if key not in blocks:
            continue
        blk = blocks[key].strip().rstrip(",")
        marker = '"routers"'
        pos = current.find(marker)
        if pos == -1:
            continue
        # após primeira chave em routers — simplificado: inserir antes de "services"
        svc_marker = '"services"'
        spos = current.find(svc_marker)
        if spos > pos:
            current = current[:spos] + blk + ",\n      " + current[spos:]
            print(f"  inserido router {key}")

if '"waba_waba_disparador-0"' not in current:
    svc_marker = '"services"'
    spos = current.find(svc_marker)
    if spos != -1:
        blk = blocks["waba_waba_disparador-0"].strip().rstrip(",")
        current = current[:spos] + blk + ",\n      " + current[spos:]
        print("  inserido service waba_waba_disparador-0")

dump(cfg_path, current)
PY
fi

TRAEFIK=$(docker ps -q -f name=traefik -f status=running | head -1)
[[ -n "$TRAEFIK" ]] && docker kill -s HUP "$TRAEFIK" 2>/dev/null || docker restart "$TRAEFIK" >/dev/null
sleep 4

code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "https://${HOST}/health" 2>/dev/null || echo "000")
echo "RESULTADO https://${HOST}/health -> HTTP ${code}"
[[ "$code" == "200" ]]
