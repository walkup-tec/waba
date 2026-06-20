# LOG — Split: Custo total = Fornecedor + CET

**Data:** 2026-06-17

## Fórmula

```
Custo fornecedor = envios × custo/envio  → repasse PIX
CET              = taxa Asaas (retido na fonte, sem PIX)
Custo total      = fornecedor + CET
Lucro a dividir  = valor pago − custo total  → rateio % masters via PIX
```

## Exemplo R$ 30 / 100 envios (oficial R$ 0,19)

| Item | Valor |
|------|-------|
| Pago | R$ 30,00 |
| Fornecedor | R$ 19,00 (PIX) |
| CET | R$ 2,98 (retido Asaas) |
| Custo total | R$ 21,98 |
| Lucro a dividir (50/50) | R$ 8,02 → R$ 4,01 cada |

## Código

- `waba-financeiro-split.service.ts` — `buildSplitCostBreakdown`
- Linha `cet` no settlement (skipped, sem repasse)
- UI: colunas Custo total / Lucro a dividir; linha CET no rateio

Settlements antigos mantêm valores gravados até nova compra.
