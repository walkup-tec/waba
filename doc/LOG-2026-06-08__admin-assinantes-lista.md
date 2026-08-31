# LOG — Admin · Assinantes (listagem master)

**Data:** 2026-06-08

## Pedido
Listar assinantes no menu Admin → Assinantes com: Nome, CPF/CNPJ, Data inscrição, Créditos (R$), Disparos, Aguardando, Finalizados.

## Backend
- `src/admin/waba-admin-subscribers.service.ts` — agrega subscribers + créditos pagos + intakes
- `src/admin/waba-admin.routes.ts` — `GET /admin/subscribers` (somente `role: master`)
- `WabaCampaignIntakeRepository.listAll()`
- Registro em `src/index.ts`

## Regras de métricas
| Coluna | Fonte |
|--------|--------|
| Créditos | Soma `valueCents` pedidos `waba-disparos` pagos |
| Disparos | Soma envios contratados nos pedidos pagos |
| Aguardando | Campanhas intake `generated`, `pending_review` ou `in_progress` |
| Finalizados | Campanhas intake `completed` |

## Frontend
- `index.html` — tabela em `#tab-admin-assinantes`, `loadAdminSubscribers()` ao abrir aba

## Validação
- `GET /admin/subscribers` como master → 2 assinantes (mozart + teste)
- mozart: R$ 5,00, 100 disparos, 1 aguardando

## Deploy marker
`DEPLOY-2026-06-08-admin-assinantes-lista-v1`
