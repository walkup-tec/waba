# LOG — 500 envios API Alternativa (mozart)

**Data:** 2026-06-12

## Solicitação
Adicionar crédito como contratação **API Alternativa**, 500 envios.

## Alteração
Pedido `paid` em `data/v02/waba-billing-orders.json`:
- `id`: `a21d204d-3be4-4f02-8a5d-6eda4481ee55`
- `ownerEmail`: `mozart.pmo@gmail.com`
- `apiKind`: `alternativa`
- `shipmentCount`: 500
- `valueCents`: 12500 (R$ 125,00 · ~R$ 0,25/envio)
- `status`: `paid`, `paidAt`: 2026-06-12T14:00:00.000Z

## Saldo esperado (v02)
- Contratados: 2410 (1910 anteriores + 500)
- Consumidos: 1910
- **Disponíveis: 500**
- Plano ativo (último pedido pago): **API Alternativa**

## Validação
F5 logado como `mozart.pmo@gmail.com` → Resumo Disparos → "Ainda disponíveis: 500"; contratação reflete API Alternativa.
