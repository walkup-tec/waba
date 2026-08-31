# LOG — Financeiro split layout em colunas

**Data:** 2026-06-17  
**Pedido:** Separar descrição, valor e ícones nas linhas do rateio (formato tabela).

## Alterações

- `index.html`:
  - CSS `.admin-financeiro-split-grid` + `.admin-financeiro-split-line` (grid 3 colunas por linha)
  - `formatSplitSettlementLineLabel()` — só rótulo (CET Asaas, Fornecedor…)
  - `formatSplitSettlementLineValue()` — valor + nota (envios, retido na fonte, %)
  - `renderSplitSettlementLineRow()` — uma `<div>` por linha com desc | value | icons
  - `src/deploy-marker.ts` — `DEPLOY-2026-06-17-split-grid-columns`

## Validação

- `npm run build` — OK

## Pendências

- Reiniciar `npm run dev:v02` e F5 na aba Financeiro para validar visualmente
- Testar retry linha Teste Split no pedido `7e2213b8-3064-413f-8666-a627420f1738`
