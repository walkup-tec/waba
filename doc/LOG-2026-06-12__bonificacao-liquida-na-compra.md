# LOG — Bonificação liquida na próxima compra

**Data:** 2026-06-12

## Regra
Assinante com créditos bonificados pendentes: na **próxima compra paga**, os envios bonificados somam ao pacote comprado e o saldo bonificado zera.

Ex.: 200 bonificados + compra 500 → **700 disponíveis**, **0 bonificação**.

## Problema
Liquidação só rodava em `toPublicOrder` (polling). Créditos (`getCreditsSummary`) e webhook Asaas não aplicavam bônus.

## Implementação
- `waba-disparos-bonus-settlement.service.ts` — liquida pedidos pagos; bônus na 1ª compra após `grantedAt` do plano; reprocessa se `bonusShipmentsApplied` ainda for 0 (ver `LOG-2026-06-12__fix-bonus-soma-disponivel-compra.md`).
- `getCreditsSummary` liquida backlog antes de calcular saldo.
- Webhook `PAYMENT_RECEIVED` liquida ao confirmar pagamento.

## Mozart (v02) após fix
- `remainingShipments`: 700
- `pendingBonusShipments`: 0
- Pedido `a21d204d`: 500 + 200 bonificados = 700 envios
