#!/bin/bash
# Purge menus Admin em produção — rodar como root no VPS (Hostinger console / SSH).
# Preserva: split-config (Fornecedores+Rateio), billing-orders, assinantes, staff, push-config, créditos.
set -euo pipefail

SCRIPT_URL="${PURGE_SCRIPT_URL:-}"
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba_disparador' | grep -v v02 | grep -v v01 | head -1 || true)"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | head -1 || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "ERRO: container waba_disparador não encontrado"
  docker ps --format '{{.Names}}' | head -40
  exit 1
fi

echo "Container: $CONTAINER"

# Copia script do host se já estiver em /tmp; senão gera inline mínimo via docker exec + node -e não — usa arquivo no volume
# Preferência: script já no repo do container após deploy; fallback: /tmp no host

if docker exec "$CONTAINER" test -f /app/scripts/purge-admin-menus-production.cjs 2>/dev/null; then
  INNER="/app/scripts/purge-admin-menus-production.cjs"
elif [[ -f /tmp/purge-admin-menus-production.cjs ]]; then
  docker cp /tmp/purge-admin-menus-production.cjs "$CONTAINER":/tmp/purge-admin-menus-production.cjs
  INNER="/tmp/purge-admin-menus-production.cjs"
else
  echo "ERRO: coloque o script em /tmp/purge-admin-menus-production.cjs no VPS"
  echo "  (cole o conteúdo do repo scripts/purge-admin-menus-production.cjs)"
  exit 1
fi

echo "=== DRY-RUN ==="
docker exec "$CONTAINER" node "$INNER" --data-dir /app/data

echo ""
echo "=== APPLY + SUPABASE ==="
docker exec -e SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY "$CONTAINER" \
  node "$INNER" --data-dir /app/data --apply --with-supabase

echo ""
echo "=== HEALTH ==="
curl -sS --max-time 10 http://127.0.0.1:30180/health | head -c 400 || true
echo ""
echo "[ok] Purge concluído. Valide Admin → Campanhas / Chamados / Push / Financeiro / Dashboard."
