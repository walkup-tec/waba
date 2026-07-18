#!/bin/bash
# Gera tarball de /app/data da produção no VPS (Hostinger root).
# Uso:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/export-prod-data-hostinger.sh" \
#     -o /tmp/export-prod-data-hostinger.sh
#   sed -i 's/\r$//' /tmp/export-prod-data-hostinger.sh
#   chmod +x /tmp/export-prod-data-hostinger.sh
#   /tmp/export-prod-data-hostinger.sh
#
# Depois baixe /root/waba-prod-data.tgz pelo File Manager da Hostinger
# (ou scp) e rode localmente:
#   npm run apply:prod-tarball-v02 -- path\to\waba-prod-data.tgz

set -euo pipefail
OUT="${1:-/root/waba-prod-data.tgz}"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v02|v01' | head -1 || true)"
if [ -z "$CONTAINER" ]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [ -z "$CONTAINER" ]; then
  echo "ERRO: container waba_disparador não encontrado"
  docker ps --format '{{.Names}}' | head -40
  exit 1
fi

echo "Container: $CONTAINER"
TMP_IN="/tmp/waba-data-export-$$.tgz"
docker exec "$CONTAINER" sh -c 'cd /app/data && tar czf - --exclude="./_backups" --exclude="./vps-infra" .' > "$TMP_IN"
mv -f "$TMP_IN" "$OUT"
chmod 600 "$OUT"
ls -lh "$OUT"
echo
echo "OK. Baixe este arquivo e aplique no PC:"
echo "  npm run apply:prod-tarball-v02 -- $OUT"
echo
echo "Lista (amostra):"
docker exec "$CONTAINER" sh -c 'ls -la /app/data/*.json 2>/dev/null | head -40' || true
