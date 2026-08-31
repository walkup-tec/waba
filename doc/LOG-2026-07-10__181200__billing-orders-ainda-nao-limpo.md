# LOG — 2026-07-10 — billing-orders ainda 7780 B (comando não gravou)

## Status health

`billingOrders` sizeBytes=7780, updatedAt=2026-07-09 — limpeza não aplicada.

## Comando reforçado (VPS)

```sh
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1)
echo "CONTAINER=$CONTAINER"
docker exec "$CONTAINER" sh -c '
  set -eu
  cd /app/data
  echo BEFORE:
  ls -la waba-billing-orders.json
  mkdir -p _backups
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  cp -a waba-billing-orders.json "_backups/waba-billing-orders-${STAMP}.json"
  node -e "require(\"fs\").writeFileSync(\"/app/data/waba-billing-orders.json\", \"[]\\n\"); console.log(\"wrote\", require(\"fs\").statSync(\"/app/data/waba-billing-orders.json\").size);"
  rm -f waba-billing-orders.json.tmp
  echo AFTER:
  ls -la waba-billing-orders.json waba-financeiro-split-config.json
  head -c 20 waba-billing-orders.json; echo
'
```

Esperado AFTER: billing-orders size=3 (ou 2–4), conteúdo `[]`.
