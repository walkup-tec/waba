# LOG — 2026-07-10 — Purge menus Admin produção (plano + script)

## Pedido

Limpar dados de produção nos menus Admin:
- Dashboard
- Campanhas
- Financeiro (manter informações registradas + Fornecedores + Rateio do lucro)
- Chamados
- Push

## Interpretação Financeiro (confirmar)

| Manter | Arquivo |
|--------|---------|
| Fornecedores | `waba-financeiro-split-config.json` → `suppliers[]` |
| Rateio do lucro | mesmo arquivo → `participants[]` |
| Informações registradas | `waba-billing-orders.json` (pedidos / cobranças) |

| Limpar no Financeiro | Arquivo |
|----------------------|---------|
| Histórico de splits / liquidações PIX | `waba-financeiro-split-settlements.json` |

## Limpar

| Menu | Alvos |
|------|-------|
| Campanhas | `waba-campaign-intakes.json`, pasta `campaign-intakes/`, `disparos-local-state.json`, opcional Supabase `disparos_campaigns` + `disparos_campaign_leads` |
| Chamados | `waba-support-tickets.json`, pasta `support-tickets/` |
| Push | `waba-push-messages.json`, pasta `push-media/` (mantém `waba-push-config.json`) |
| Dashboard | `waba-master-menu-seen.json` + efeito colateral dos dados acima |

## Script

`scripts/purge-admin-menus-production.cjs`

```bash
# Dry-run
node scripts/purge-admin-menus-production.cjs --data-dir /app/data

# Aplicar (com backup em /app/data/_backups/...)
node scripts/purge-admin-menus-production.cjs --data-dir /app/data --apply --with-supabase
```

## Status

- Script criado no workspace H:
- Terminal da sessão sem resposta — **execução em produção pendente**
- Aguardando confirmação: “informações registradas” = pedidos (`waba-billing-orders.json`)?

## Palavras-chave

`purge admin menus`, `split-config preserve`, `billing-orders keep`, `campanhas chamados push`
