# LOG — Bônus Envios (admin)

**Data:** 2026-07-14  
**Pedido:** criar recurso "Bônus Envios" acima de Cupons de desconto — creditar envios intransferíveis a um assinante, no plano Oficial/Alternativa, com validade igual à dos cupons; saldo no **Disponíveis**.

## Solução

1. **Backend** `WabaAdminBonusEnviosService` + `POST /admin/bonus-envios` (master):
   - Seleciona assinante por `subscriberId` ou e-mail
   - Cria pedido `waba-disparos` `paid` com `ownerEmail` do assinante
   - `grantSource: admin-bonus-envios`, `valueCents: 0`, `shipmentCount` informado
   - `creditsValidUntil` conforme validade (12h / 24h / custom / lifetime)
   - Bets + API Alternativa → erro

2. **Saldo Disponível** — `resolveActiveOrderShipmentCount` ignora pedidos com `creditsValidUntil` expirado. Créditos ficam só no e-mail do `ownerEmail` (intransferíveis).

3. **UI** (Assinantes): bloco **Bônus Envios** acima dos cupons — busca assinante (nome/e-mail/WhatsApp), quantidade, tipo de plano, validade, botão **Creditar Envios**.

4. **Financeiro** — grants `admin-bonus-envios` excluídos da listagem/resumo (não poluem receita).

## Arquivos

- `src/admin/waba-admin-bonus-envios.service.ts` (novo)
- `src/admin/waba-admin.routes.ts`
- `src/admin/waba-admin-subscribers.service.ts` (whatsapp na lista; label histórico)
- `src/admin/waba-admin-financeiro.service.ts`
- `src/billing/waba-billing-order.repository.ts`
- `src/billing/waba-disparos-order-shipments.ts`
- `src/billing/waba-disparos-credits.service.ts`
- `index.html`

## Validar

1. Master → Assinantes → Bônus Envios
2. Buscar assinante, informar envios, plano, validade → Creditar Envios
3. Login do assinante → Disparos/Créditos → **Disponíveis** do plano creditado deve aumentar
4. Confirmar que outro assinante não recebe o crédito

## Segurança

- Rota só master
- Pedido sempre com `ownerEmail` do assinante escolhido
- Sem tokens/segredos no payload

## Keywords

`bonus-envios`, `creditar envios`, `admin-bonus-envios`, `creditsValidUntil`, `Disponíveis`, cupons
