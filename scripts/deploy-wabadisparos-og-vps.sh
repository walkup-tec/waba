#!/bin/bash
# Publica imagem OG + patch index.html no serviço waba_paginadevendas (wabadisparos.com.br).
# Uso no VPS (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/deploy-wabadisparos-og-vps.sh" -o /tmp/deploy-wabadisparos-og.sh
#   sed -i 's/\r$//' /tmp/deploy-wabadisparos-og.sh && chmod +x /tmp/deploy-wabadisparos-og.sh
#   /tmp/deploy-wabadisparos-og.sh
set -euo pipefail

OG_URL="https://raw.githubusercontent.com/walkup-tec/waba/master/paginadevendas/public/wabadisparos-og.jpg"
SITE="https://wabadisparos.com.br"
OG_PATH="/wabadisparos-og.jpg"

echo "=== deploy-wabadisparos-og $(date -Is) ==="

CID=$(docker ps -q -f name=waba_paginadevendas -f status=running | head -1)
if [[ -z "$CID" ]]; then
  echo "ERRO: container waba_paginadevendas não encontrado"
  exit 1
fi

TMP=$(mktemp)
curl -fsSL "$OG_URL" -o "$TMP"
docker cp "$TMP" "${CID}:/usr/share/nginx/html${OG_PATH}" 2>/dev/null \
  || docker cp "$TMP" "${CID}:/app/dist${OG_PATH}" 2>/dev/null \
  || docker cp "$TMP" "${CID}:${OG_PATH}" 2>/dev/null \
  || { echo "ERRO: não foi possível copiar imagem para o container"; exit 1; }
rm -f "$TMP"

INDEX=$(docker exec "$CID" sh -c 'test -f /usr/share/nginx/html/index.html && echo /usr/share/nginx/html/index.html || test -f /app/dist/index.html && echo /app/dist/index.html || echo ""')
if [[ -z "$INDEX" ]]; then
  echo "AVISO: index.html não encontrado no container — meta OG depende do redeploy Git"
else
  docker exec "$CID" sh -c "grep -q 'og:image' '$INDEX' || sed -i 's|<meta property=\"og:type\" content=\"website\"/>|<meta property=\"og:type\" content=\"website\"/><meta property=\"og:image\" content=\"${SITE}${OG_PATH}\"/><meta property=\"og:image:type\" content=\"image/jpeg\"/><meta property=\"og:image:width\" content=\"1200\"/><meta property=\"og:image:height\" content=\"630\"/><meta name=\"twitter:image\" content=\"${SITE}${OG_PATH}\"/>|' '$INDEX'"
  echo "index.html patchado em $INDEX"
fi

code=$(curl -sS -o /dev/null -w "%{http_code}" "${SITE}${OG_PATH}" || echo "000")
echo "GET ${SITE}${OG_PATH} → HTTP ${code}"
echo "Validar preview: https://developers.facebook.com/tools/debug/?q=${SITE}"
