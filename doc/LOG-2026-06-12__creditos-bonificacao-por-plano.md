# LOG — Créditos e bonificação por plano (Oficial / Alternativa)

**Data:** 2026-06-12

## Regra
- Saldo **disponível** e **bonificado** separados por `oficial` | `alternativa`.
- Bonificação de campanha entra no plano da campanha (`apiKind` do intake).
- Na próxima compra **do mesmo plano**, bônus pendente soma ao pedido e zera (via `bonusShipmentsApplied` no pedido).
- Consumo de envios debita do plano da campanha criada.

## Backend
- `waba-disparos-credits.service.ts` → `byApi`, `activeApiKind`
- `waba-disparos-bonus.repository.ts` → grants por plano; pendente = grants − já aplicados em pedidos
- `waba-disparos-credit-usage.repository.ts` → consumo por plano
- `waba-disparos-bonus-settlement.service.ts` → liquidação por `order.apiKind`

## UI
- Card **Ainda disponíveis** no Resumo: grid API Oficial | API Alternativa (disponíveis + bonificados).

## Mozart (v02) após fix
- Oficial: 0 disponíveis, 200 bonificados
- Alternativa: 700 disponíveis, 0 bonificados
