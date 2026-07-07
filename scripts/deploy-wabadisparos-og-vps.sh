#!/bin/bash
# DEPRECATED — use deploy-paginadevendas-og-vps.sh (SSR TanStack).
# Mantido como atalho: publica imagem DRAX + aplica og:image na landing.
#
# og:image → https://waba.draxsistemas.com.br/media/OGwaba.jpg
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MASTER="${MASTER:-https://raw.githubusercontent.com/walkup-tec/waba/master}"

echo "=== deploy-wabadisparos-og (wrapper) $(date -Is) ==="
echo "1/2 Publicar imagem no domínio DRAX..."
curl -fsSL "${MASTER}/scripts/publish-wabadisparos-og-image-drax-vps.sh" -o /tmp/publish-og-drax.sh
sed -i 's/\r$//' /tmp/publish-og-drax.sh && chmod +x /tmp/publish-og-drax.sh
/tmp/publish-og-drax.sh

echo "2/2 Patch og:image na landing wabadisparos (SSR)..."
curl -fsSL "${MASTER}/scripts/deploy-paginadevendas-og-vps.sh" -o /tmp/deploy-pv-og.sh
sed -i 's/\r$//' /tmp/deploy-pv-og.sh && chmod +x /tmp/deploy-pv-og.sh
OG_IMAGE="https://waba.draxsistemas.com.br/media/OGwaba.jpg" \
OG_TYPE="image/jpeg" \
OG_WIDTH="1200" \
OG_HEIGHT="630" \
/tmp/deploy-pv-og.sh
