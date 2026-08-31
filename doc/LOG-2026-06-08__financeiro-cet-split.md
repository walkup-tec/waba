# LOG — CET no split financeiro (Custo Efetivo Total)

**Data:** 2026-06-08

## Correção de nomenclatura

COF renomeado para **CET** (Custo Efetivo Total) em UI, API, código e env.

## UI

`CET = R$ 2,98 por operação` na linha Integração Asaas.

## Env

`WABA_FINANCEIRO_CET_CENTS_PER_OPERATION=298` (aceita legado `WABA_FINANCEIRO_COF_CENTS_PER_OPERATION`).

## Fórmula

```
lucro bruto   = valor pago − custo fornecedor
CET           = R$ 2,98 por cobrança PIX
distribuível  = max(0, lucro bruto − CET) → rateio masters
```

## Arquivos

- `src/billing/waba-financeiro-cet.ts` (substitui `waba-financeiro-cof.ts`)
- Settlement: campo `cetCents` (leitura legada `cofCents`)
