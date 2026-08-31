# Reset saldo Mozart — 500 Oficial + 500 Alternativa

**Data:** 2026-06-12  
**Assinante:** mozart.pmo@gmail.com (`625e892e-9287-4f6c-930d-a370d7193a53`)  
**Ambiente:** `WABA_ENV=v02`

## Pedido do usuário
Deixar apenas:
- API Oficial: 500 envios
- API Alternativa: 500 envios

## Alterações em `data/v02/`

1. **waba-billing-orders.json** — removidos pedidos antigos do Mozart; 2 pedidos `paid` (500 oficial, 500 alternativa).
2. **waba-disparos-credit-usage.json** — `consumedOficial: 0`, `consumedAlternativa: 0`.
3. **waba-disparos-bonus-balances.json** — entrada Mozart removida.
4. **waba-campaign-intakes.json** — `plannedSendCount: 0` nos intakes Mozart (evita migração de consumo); relatórios com `sent = totalLeads` (zera bônus pendente de campanhas finalizadas).

## Validação

```
getCreditsSummary('mozart.pmo@gmail.com'):
  oficial:     500 disponíveis, 0 bonificados, 0 consumidos
  alternativa: 500 disponíveis, 0 bonificados, 0 consumidos
  total: 1000
```

## Pendências
- Intakes Mozart com `plannedSendCount: 0` — histórico de envios planejados não reflete valores antigos na UI.
- Sem commit/deploy (só dados locais v02).
