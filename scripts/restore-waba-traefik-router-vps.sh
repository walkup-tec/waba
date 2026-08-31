#!/bin/bash
# Restaura routers/serviço WABA no Traefik quando Easypanel remove waba.draxsistemas do main.yaml.
# Uso: bash restore-waba-traefik-router-vps.sh
set -euo pipefail

CFG=/etc/easypanel/traefik/config/main.yaml
HOST="${WABA_PUBLIC_HOST:-waba.draxsistemas.com.br}"
BACKEND="${WABA_BACKEND_URL:-http://172.17.0.1:30180/}"
BACKEND="${BACKEND%/}/"
PERMANENT="${WABA_TRAEFIK_PERMANENT_SCRIPT:-/root/traefik-permanent-waba-vps.sh}"

[[ -f "$CFG" ]] || { echo "ERRO: $CFG não existe"; exit 1; }

patch_waba_backend() {
  python3 - "$CFG" "$BACKEND" <<'PY'
import re, sys
path, backend = sys.argv[1:3]
text = open(path, encoding="utf-8").read()
pat = re.compile(
    r'("waba[^"]*disparador[^"]*"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")',
    re.I,
)
text, n = pat.subn(rf"\g<1>{backend}\2", text)
open(path, "w", encoding="utf-8").write(text)
print(f"  backend waba -> {backend} ({n}x)")
PY
}

reload_traefik() {
  local traefik
  traefik=$(docker ps -q -f name=traefik -f status=running | head -1)
  [[ -z "$traefik" ]] && { echo "ERRO: container Traefik não encontrado"; return 1; }
  docker kill -s HUP "$traefik" 2>/dev/null || docker restart "$traefik" >/dev/null
  echo "$traefik"
}

find_backup() {
  local f
  for f in $(ls -t /etc/easypanel/traefik/config/main.yaml.bak* 2>/dev/null); do
    if grep -q "Host(\`${HOST}\`)" "$f" 2>/dev/null; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

if grep -q "Host(\`${HOST}\`)" "$CFG" 2>/dev/null; then
  echo "OK: router ${HOST} já existe — só ajustando URL do backend"
  patch_waba_backend
else
  BAK=""
  BAK=$(find_backup || true)
  if [[ -z "$BAK" ]]; then
    echo "ERRO: nenhum backup com ${HOST} em /etc/easypanel/traefik/config/"
    echo "  Recrie o domínio no Easypanel → waba → waba_disparador → Domínios"
    exit 1
  fi
  echo "Restaurando main.yaml completo de: $BAK"
  cp -a "$CFG" "${CFG}.bak-before-restore-$(date +%Y%m%d-%H%M%S)"
  cp -a "$BAK" "$CFG"
  patch_waba_backend
fi

if ! grep -q "Host(\`${HOST}\`)" "$CFG" 2>/dev/null; then
  echo "ERRO: ${HOST} ainda ausente em ${CFG} após restore"
  exit 1
fi

reload_traefik
sleep 2

if [[ -x "$PERMANENT" ]]; then
  echo "Executando ${PERMANENT} run"
  "$PERMANENT" run || true
else
  sleep 4
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 12 "https://${HOST}/health" 2>/dev/null || echo "000")
  echo "RESULTADO https://${HOST}/health -> HTTP ${code}"
  [[ "$code" == "200" ]]
fi
