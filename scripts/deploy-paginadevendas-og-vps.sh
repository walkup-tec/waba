#!/bin/bash
# Injeta meta OG no bundle SSR de wabadisparos.com.br (waba_paginadevendas).
# NÃO usa docker service update --force (preserva task Swarm).
#
# Uso no VPS (root):
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/deploy-paginadevendas-og-vps.sh" -o /tmp/deploy-pv-og.sh
#   sed -i 's/\r$//' /tmp/deploy-pv-og.sh && chmod +x /tmp/deploy-pv-og.sh
#   /tmp/deploy-pv-og.sh
#
# Variáveis opcionais:
#   OG_IMAGE  OG_TYPE  OG_WIDTH  OG_HEIGHT
set -euo pipefail
set +H

OG_IMAGE="${OG_IMAGE:-https://waba.draxsistemas.com.br/media/OGwaba.jpg}"
OG_TYPE="${OG_TYPE:-image/jpeg}"
OG_WIDTH="${OG_WIDTH:-1200}"
OG_HEIGHT="${OG_HEIGHT:-630}"
OG_TITLE="${OG_TITLE:-DRAX WABA - Plataforma Oficial de Disparos WhatsApp}"
OG_DESCRIPTION="${OG_DESCRIPTION:-Envie mensagens em massa pelo WhatsApp utilizando API Oficial e API Alternativa. Plataforma completa para automação, aquecimento de números e gestão de campanhas.}"
TW_DESCRIPTION="${TW_DESCRIPTION:-Envie mensagens em massa pelo WhatsApp utilizando API Oficial e API Alternativa.}"
ROUTER="/app/.output/server/_ssr/router-aV5ItMUH.mjs"
PATCH_URL="${PATCH_URL:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/patch-paginadevendas-router-og.cjs}"
SITE="https://wabadisparos.com.br"

echo "=== deploy-paginadevendas-og $(date -Is) ==="
echo "OG_IMAGE=${OG_IMAGE}"

CID=$(docker ps -q -f name=waba_paginadevendas -f status=running | head -1)
if [[ -z "$CID" ]]; then
  echo "ERRO: container waba_paginadevendas não encontrado"
  exit 1
fi
echo "CID=${CID}"

TMP=$(mktemp)
curl -fsSL "$PATCH_URL" -o "$TMP"
docker cp "$TMP" "${CID}:/tmp/patch-paginadevendas-router-og.cjs"
rm -f "$TMP"

docker exec -e OG_IMAGE="$OG_IMAGE" -e OG_TYPE="$OG_TYPE" -e OG_WIDTH="$OG_WIDTH" -e OG_HEIGHT="$OG_HEIGHT" \
  -e OG_TITLE="$OG_TITLE" -e OG_DESCRIPTION="$OG_DESCRIPTION" -e TW_DESCRIPTION="$TW_DESCRIPTION" \
  "$CID" node /tmp/patch-paginadevendas-router-og.cjs

echo "Reiniciando container (sem force update do serviço)..."
docker restart "$CID" >/dev/null
sleep 15

code=$(docker exec "$CID" sh -c "wget -qSO- http://127.0.0.1:3000/ 2>&1 | head -1" | awk '/HTTP\// {print $2; exit}' || echo "000")
echo "GET / interno → HTTP ${code}"

html=$(curl -fsSL "$SITE/" 2>/dev/null || true)
if echo "$html" | grep -q 'property="og:image"'; then
  echo "$html" | grep -E 'property="og:(image|image:type|image:width|image:height|type)"' | head -6
  echo "OK: meta OG visível no HTML externo"
else
  echo "AVISO: og:image não encontrado no HTML externo — aguarde health ou confira Traefik"
  echo "$html" | grep -E 'og:|twitter:' | head -8 || true
fi

img_code=$(curl -sS -o /dev/null -w "%{http_code}" "$OG_IMAGE" || echo "000")
echo "GET OG image → HTTP ${img_code}"
echo "Debug Meta: https://developers.facebook.com/tools/debug/?q=${SITE}"
