# LOG — simulação compra 30 números (walkup V02)

**Data:** 2026-06-20

## Pedido
Simular no backend compra de 30 chips para `walkup@walkuptec.com.br` no V02 (saldo por usuário).

## Backend
- `WabaAlternativaNumbersService.simulatePaidPurchase(email, quantity)` — pedido `paid` em `waba-billing-orders.json` com `product: waba-alternativa-numbers`, `ownerEmail` do usuário.
- `POST /billing/alternativa-numbers/simulate-purchase` — só V02 ou `RUNTIME_MODE=development`; usa e-mail da sessão logada.
- Script: `npx ts-node scripts/simulate-alternativa-numbers-purchase.ts <email> <qty>`

## Executado
```bash
WABA_ENV=v02 npx ts-node scripts/simulate-alternativa-numbers-purchase.ts walkup@walkuptec.com.br 30
```
- orderId: `4e39c959-31b7-4ec6-8123-a4c78110773d`
- summary: purchasedSlots=30, availableSlots=30, activatedCount=0

## Reteste UI
Ctrl+F5 → API Alternativa → Comprar números → deve mostrar **30 comprados / 30 disponíveis**.
