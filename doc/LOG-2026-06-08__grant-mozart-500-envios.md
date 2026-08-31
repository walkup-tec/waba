# LOG — Grant 500 envios mozart.pmo@gmail.com

**Data:** 2026-06-08  
**Pedido:** crédito cortesia sem pagar pacote.

## Ação
Pedido `paid` manual em `data/v02/waba-billing-orders.json`:
- `id`: `a3c8e2f1-9b4d-4c7e-8f1a-grant-mozart500`
- `ownerEmail`: `mozart.pmo@gmail.com`
- `shipmentCount`: 500
- `valueCents`: 0

## Saldo após grant (v02 local)
| Campo | Valor |
|-------|-------|
| Contratados | 600 (100 pagos + 500 cortesia) |
| Consumidos | 100 |
| Disponíveis | **500** |

## Validação
F5 em `http://localhost:3012/version-02/` logado como mozart → resumo "Ainda disponíveis: 500".

## Nota
Alteração só no ambiente local `data/v02/`. Produção exige mesmo pedido no volume `data/waba-billing-orders.json` da VPS.
