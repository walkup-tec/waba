#!/bin/bash
# Restaura routers/serviço Evolution (walkup evo-walkup-api) no Traefik quando Easypanel
# remove walkup-evo-walkup-api.achpyp.easypanel.host do main.yaml.
# Uso: bash restore-walkup-evo-traefik-router-vps.sh
set -euo pipefail

CFG=/etc/easypanel/traefik/config/main.yaml
HOST="${EVO_PUBLIC_HOST:-walkup-evo-walkup-api.achpyp.easypanel.host}"
BACKEND="${EVO_BACKEND_URL:-http://172.17.0.1:30181/}"
BACKEND="${BACKEND%/}/"
PERMANENT="${EVO_TRAEFIK_PERMANENT_SCRIPT:-/root/traefik-permanent-walkup-evo-vps.sh}"

[[ -f "$CFG" ]] || { echo "ERRO: $CFG não existe"; exit 1; }

patch_evo_backend() {
  python3 - "$CFG" "$BACKEND" <<'PY'
import re, sys
path, backend = sys.argv[1:3]
text = open(path, encoding="utf-8").read()
backend = backend.rstrip("/") + "/"
pat = re.compile(
    r'("walkup[^"]*evo[^"]*walkup-api[^"]*"\s*:\s*\{[\s\S]*?"url"\s*:\s*")[^"]+(")',
    re.I,
)
text, n = pat.subn(rf"\g<1>{backend}\2", text)
for old in (
    "http://walkup_evo-walkup-api:8080/",
    "http://tasks.walkup_evo-walkup-api:8080/",
    "http://walkup-evo-walkup-api:8080/",
):
    if old in text:
        text = text.replace(old, backend)
        n += 1
open(path, "w", encoding="utf-8").write(text)
print(f"  backend evo -> {backend} ({n} alterações)")
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
  patch_evo_backend
else
  BAK=""
  BAK=$(find_backup || true)
  if [[ -z "$BAK" ]]; then
    echo "ERRO: nenhum backup com ${HOST} em /etc/easypanel/traefik/config/"
    echo "  Easypanel → walkup → evo-walkup-api → Domínios → salvar de novo"
    exit 1
  fi
  echo "AVISO: router ausente — restaurando main.yaml de: $BAK"
  echo "  (se WABA/Typebot quebrar, rode /root/traefik-permanent-waba-vps.sh run)"
  cp -a "$CFG" "${CFG}.bak-before-evo-restore-$(date +%Y%m%d-%H%M%S)"
  cp -a "$BAK" "$CFG"
  patch_evo_backend
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
fi

code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 12 \
  -H "apikey: ${EVO_API_KEY:-429683C4C977415CAAFCCE10F7D57E11}" \
  "https://${HOST}/instance/fetchInstances" 2>/dev/null || echo "000")
echo "RESULTADO https://${HOST}/instance/fetchInstances -> HTTP ${code}"
[[ "$code" == "200" || "$code" == "401" ]]
