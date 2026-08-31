# LOG — 2026-07-10 — Purge Admin menus: escopo confirmado, SSH bloqueado

## Confirmação do usuário

- Push: excluir **apenas o histórico** da tabela (print anexado) → `waba-push-messages.json` (+ `push-media/`)
- Demais itens do plano: OK
- Autorizou continuidade

## Bloqueio

Esta máquina **não tem chave SSH** (`~\.ssh` só `known_hosts`).  
`VPS_SSH_PRIVATE_KEY` no GitHub Actions também estava ausente (falha documentada 09/07).  
Não foi possível aplicar em `/app/data` do `waba_disparador` a partir daqui.

## Script pronto

- `scripts/purge-admin-menus-production.cjs`
- `scripts/purge-admin-menus-on-vps.sh` (wrapper no VPS)

## Como aplicar (Hostinger console / root@srv1261237)

1. Colar o arquivo `purge-admin-menus-production.cjs` em `/tmp/` no VPS  
   (ou fazer deploy do repo e usar `/app/scripts/...` após rebuild)
2. Rodar:

```bash
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'waba_disparador' | grep -v v02 | grep -v v01 | head -1)
docker cp /tmp/purge-admin-menus-production.cjs "$CONTAINER":/tmp/purge-admin-menus-production.cjs
docker exec "$CONTAINER" node /tmp/purge-admin-menus-production.cjs --data-dir /app/data
docker exec "$CONTAINER" node /tmp/purge-admin-menus-production.cjs --data-dir /app/data --apply --with-supabase
```

Backup automático em `/app/data/_backups/purge-admin-menus-<timestamp>/`.

## Preserva

- Fornecedores + Rateio → `waba-financeiro-split-config.json`
- Pedidos → `waba-billing-orders.json`
- Push config comunidade → `waba-push-config.json`

## Palavras-chave

`purge admin`, `push histórico`, `SSH blocked`, `Hostinger console`
