# LOG — 2026-07-10 — Purge Admin menus aplicado com sucesso

## Resultado (SSH root@srv1261237)

| Arquivo | sizeBytes | Status |
|---------|-----------|--------|
| waba-campaign-intakes.json | 36 | limpo |
| waba-push-messages.json | 37 | limpo |
| waba-support-tickets.json | 36 | limpo |
| waba-financeiro-split-settlements.json | 40 | limpo |
| waba-billing-orders.json | 7780 | **preservado** |
| waba-financeiro-split-config.json | 1211 | **preservado** (Fornecedores + Rateio) |

- Pastas `campaign-intakes`, `support-tickets`, `push-media` limpas
- Supabase campanhas/leads: OK
- Backup: `/app/data/_backups/purge-admin-menus-20260710T203516Z`
- Container reiniciado

## Validação UI

Ctrl+F5 em Admin → Campanhas, Chamados, Push, Financeiro, Dashboard.

## Palavras-chave

`purge sucesso`, `sh not bash`, `split-config keep`
