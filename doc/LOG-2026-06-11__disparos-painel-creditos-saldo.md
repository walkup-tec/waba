# LOG — painel de créditos na tela Disparos

**Data:** 2026-06-11  
**Pedido:** após contratar disparos, exibir créditos contratados, consumidos e saldo restante.

## Backend
- `src/billing/waba-disparos-credits.service.ts` — resumo por e-mail (soma pedidos `paid`).
- `src/billing/waba-disparos-credit-usage.repository.ts` — consumo persistido em `waba-disparos-credit-usage.json`.
- `GET /billing/disparos/credits` — requer login; retorna contracted/consumed/remaining.
- Campanhas gravam `ownerEmail`; cada envio debita 1 crédito do assinante.

## Frontend (`index.html`)
- Painel `#disparos-credits-panel` no topo de `tab-disparos-lancamento`.
- `loadDisparosCredits()` ao logar, ao abrir aba Disparos e após PIX confirmado.

## Validação
- Login com assinante que tem pedido `paid` → aba Disparos mostra painel.
- Ctrl+F5 se só HTML mudou; reiniciar API se backend mudou.

## Pendências
- Campanhas antigas sem `ownerEmail` não debitam consumo retroativo.
- Pedidos legados sem `shipmentCount` estimam envios por `valueCents / 30`.
