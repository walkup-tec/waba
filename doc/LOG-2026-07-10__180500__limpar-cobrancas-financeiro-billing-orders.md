# LOG — 2026-07-10 — Limpar cobranças Financeiro (billing-orders)

## Pedido

Excluir as 6 cobranças conciliadas exibidas no Admin Financeiro (print).

## Alvo

- Limpar: `waba-billing-orders.json` → `[]`
- Manter: `waba-financeiro-split-config.json` (Fornecedores + Rateio)
- Settlements já estavam vazios do purge anterior

## Comando VPS (sh, sem bash)

```sh
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba' | grep -Ei 'disparador' | grep -vi 'v02' | grep -vi 'v01' | head -1)
echo "CONTAINER=$CONTAINER"
docker exec "$CONTAINER" sh -c '
  set -eu
  cd /app/data
  mkdir -p _backups
  STAMP=$(date -u +%Y%m%dT%H%M%SZ)
  cp -a waba-billing-orders.json "_backups/waba-billing-orders-${STAMP}.json"
  printf "%s\n" "[]" > waba-billing-orders.json
  ls -la waba-billing-orders.json waba-financeiro-split-config.json
'
# sem restart necessário — UI lê o JSON a cada request; Ctrl+F5
curl -sS --max-time 10 https://waba.draxsistemas.com.br/health | head -c 200
```

## Nota

Créditos já creditados aos assinantes (Mozart, obotmoney, etc.) **não** são removidos por este passo — só a tabela de cobranças. Se quiser zerar créditos também, avisar.

## Palavras-chave

`billing-orders`, `cobranças financeiro`, `purge pedidos`
