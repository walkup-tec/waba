# LOG — Bonificados somam ao disponível na compra

**Data:** 2026-06-12  
**Pedido:** bonificados existentes antes da compra devem somar ao disponível (não ficar separados).

## Causa
`settlePaidOrder` ignorava pedidos com `bonusSettlementAt` preenchido, mesmo com `bonusShipmentsApplied: 0` (simulações e liquidação incompleta).

## Correção
- `waba-disparos-bonus-settlement.service.ts`: reprocessa pedidos sem bônus aplicado; 1ª compra paga após `grantedAt` recebe todo o pending do plano.
- `waba-disparos-bonus.repository.ts` + service: `getEarliestGrantAt`.
- `settleAllUnsettledPaidOrdersForEmail` processa todos os pedidos pagos (ordem cronológica).

## Mozart (v02) após fix
| Plano | Disponíveis | Bonificados |
|-------|-------------|-------------|
| API Oficial | 700 | 0 |
| API Alternativa | 650 | 0 |

Pedidos atualizados: oficial `54666544` → 700 (500+200); alternativa `3721f6ae` → 550 (500+50).

## Validar
`WABA_ENV=v02` → F5 Disparos → Saldos; ou `getCreditsSummary('mozart.pmo@gmail.com')`.
