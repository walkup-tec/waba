# LOG — 2026-07-10 — Purge falhou: dados ainda no /app/data

## Sintoma

Usuário rodou no SSH mas menus continuam com dados. Health confirma:

| Arquivo | sizeBytes | Status |
|---------|-----------|--------|
| campaignIntakes | 86151 | NÃO limpo |
| pushMessages | 36969 | NÃO limpo |
| financeiroSettlements | 17618 | NÃO limpo |
| supportTickets | 9754 | NÃO limpo |
| disparosLocal | ~93 | ok-ish |
| financeiroSplit / billingOrders | intactos | OK (preservar) |

## Causa provável

1. Dry-run sem `--apply`, ou script em path errado / data-dir errado
2. Processo em memória pode regravar `disparos-local-state` / rehidratar do Supabase — precisa **restart** após wipe + limpar Supabase

## Solução

Script direto (sem .cjs): `scripts/purge-admin-menus-direct-vps.sh`

No VPS, colar o bloco bash do script ou:

```bash
# baixar/colar o .sh e:
bash purge-admin-menus-direct-vps.sh
```

Esperado após sucesso: intakes/push/tickets/settlements ~40–80 bytes; split-config e billing-orders inalterados.

## Palavras-chave

`purge falhou`, `docker exec node -e`, `restart container`, `supabase truncate`
