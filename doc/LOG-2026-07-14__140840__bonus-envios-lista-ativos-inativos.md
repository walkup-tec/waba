# LOG — Lista Ativos/Inativos Bônus Envios

**Data:** 2026-07-14  
**Pedido:** após creditar, listar no mesmo padrão dos cupons (Ativos/Inativos) com o mesmo critério de validade.

## Solução
- Tabela sob o formulário **Bônus Envios** (Assinante | Envios | Plano | Validade | Status | Ações)
- Buckets Ativos / Inativos + Atualizar
- **Ativo:** `grantActive !== false` e validade ainda válida (`creditsValidUntil` futuro ou vitalícia)
- **Inativo:** desativado manualmente, expirado
- `GET /admin/bonus-envios` + `PATCH /admin/bonus-envios/:id/deactivate`
- Desativar remove do Disponível (`grantActive: false`)

## Arquivos
- `src/admin/waba-admin-bonus-envios.service.ts`
- `src/admin/waba-admin.routes.ts`
- `src/billing/waba-billing-order.repository.ts`
- `src/billing/waba-disparos-order-shipments.ts`
- `index.html` / `dist/`

## Validar
1. Creditar Envios → aparece em Ativos
2. Aguardar expirar (12h/24h) ou Desativar → Inativos; saldo some do Disponível

## Keywords
`bonus-envios-lista`, Ativos, Inativos, grantActive, desativar bônus
