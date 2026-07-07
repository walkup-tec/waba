#!/bin/bash
# Publica imagem OG da wabadisparos.com.br em waba.draxsistemas.com.br/media/
#
# Link público gerado:
#   https://waba.draxsistemas.com.br/media/OGwaba.jpg
#
# Uso no VPS (root) — baixa a imagem do GitHub automaticamente:
#   curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/publish-wabadisparos-og-image-drax-vps.sh" -o /tmp/publish-og-drax.sh
#   sed -i 's/\r$//' /tmp/publish-og-drax.sh && chmod +x /tmp/publish-og-drax.sh
#   /tmp/publish-og-drax.sh
#
# Variáveis:
#   IMAGE_FILE  — caminho local do JPG (default: /tmp/OGwaba.jpg)
#   IMAGE_SRC   — URL para baixar se IMAGE_FILE não existir (default: raw GitHub)
set -euo pipefail

IMAGE_FILE="${IMAGE_FILE:-/tmp/OGwaba.jpg}"
IMAGE_SRC="${IMAGE_SRC:-https://raw.githubusercontent.com/walkup-tec/waba/master/media/OGwaba.jpg}"
PUBLIC_URL="https://waba.draxsistemas.com.br/media/OGwaba.jpg"
MEDIA_NAME="OGwaba.jpg"
FILTER="${WABA_CONTAINER_FILTER:-waba_disparador}"

echo "=== publish-wabadisparos-og-image-drax $(date -Is) ==="
echo "Link público alvo: ${PUBLIC_URL}"

if [[ ! -f "$IMAGE_FILE" ]]; then
  if [[ -n "$IMAGE_SRC" ]]; then
    echo "Baixando de ${IMAGE_SRC} → ${IMAGE_FILE}"
    curl -fsSL "$IMAGE_SRC" -o "$IMAGE_FILE"
  else
    echo "ERRO: ${IMAGE_FILE} não encontrado."
    echo "Copie o JPG para ${IMAGE_FILE} ou defina IMAGE_SRC=<url>"
    exit 1
  fi
fi

CID=$(docker ps -q -f "name=${FILTER}" -f status=running | head -1)
if [[ -z "$CID" ]]; then
  echo "ERRO: container ${FILTER} não encontrado"
  exit 1
fi
echo "CID=${CID}"

for target in "/app/dist/media/${MEDIA_NAME}" "/app/media/${MEDIA_NAME}"; do
  dir=$(dirname "$target")
  docker exec "$CID" sh -c "mkdir -p '${dir}'" 2>/dev/null || true
  docker cp "$IMAGE_FILE" "${CID}:${target}"
  docker exec "$CID" sh -c "chmod 644 '${target}'" 2>/dev/null || true
  echo "Copiado → ${target}"
done

code=$(curl -sS -o /dev/null -w "%{http_code}" "$PUBLIC_URL" || echo "000")
echo "GET ${PUBLIC_URL} → HTTP ${code}"

if [[ "$code" == "200" ]]; then
  echo "OK — use no og:image: ${PUBLIC_URL}"
else
  echo "AVISO: HTTP ${code} — aguarde proxy ou confira Traefik/waba_disparador"
fi
