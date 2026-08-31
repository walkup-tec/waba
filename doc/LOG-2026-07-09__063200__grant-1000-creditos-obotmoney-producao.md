# LOG — 1000 créditos obotmoney@gmail.com (produção)

**Data:** 2026-07-09  
**Pedido:** Conceder 1000 envios de crédito para `obotmoney@gmail.com`.

## Comando executado

```bash
node scripts/grant-disparos-credits-production.cjs obotmoney@gmail.com 1000
```

## Resultado

| Campo | Valor |
|-------|--------|
| E-mail | `obotmoney@gmail.com` |
| Envios concedidos (API Oficial) | +1000 |
| Pedido | `7d8d203f-9528-4773-9b63-b7db41e07ed2` |
| Segmento | Bets → apenas API Oficial |
| Saldo após grant | **1100 envios contratados** (`contractedShipments`) |
| Valor exibido | R$ 330,00 |

`promote-from-v02` billing-only: `billingOrdersAdded: 1`, assinante `unchanged`.

## Validação

1. Login como `obotmoney@gmail.com` → Disparos → Créditos: ~1100 envios API Oficial disponíveis (menos consumidos).
2. Admin → Assinantes: `contractedShipments: 1100`.

## Palavras-chave

`obotmoney`, grant 1000 créditos, produção, grant-disparos-credits-production, billing-only promote
