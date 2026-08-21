# LOG — Dashboard Disparos: indicadores por API Oficial e Alternativa

## Contexto

No Dashboard de Disparos, os cards (Contagem, Distribuição, Taxas) eram um único consolidado misturando as duas APIs. O pedido foi exibir os indicadores de campanhas da API Oficial e da API Alternativa.

## Solução

1. Backend (`waba-disparos-dashboard.service.ts`):
   - `indicatorsByApi` e `withReportByApi` no overview.
2. Frontend:
   - Seções empilhadas por API com label Oficial/Alternativa e métricas próprias.
   - Resumo de saldo separado por API quando `credits.byApi` existir.
3. Comparativo entre campanhas permanece com filtro Todas / Oficial / Alternativa.

## Arquivos

- `src/disparos/waba-disparos-dashboard.service.ts`
- `index.html` / `dist/index.html`
- `dist/disparos/waba-disparos-dashboard.service.js`

## Validação

- Com campanhas finalizadas nas duas APIs: duas seções de indicadores.
- Com só uma API: uma seção.
- Saldo no texto do topo: `API Oficial x/y · API Alternativa x/y` quando houver split.

## Palavras-chave

`dashboard-disparos`, `indicatorsByApi`, `api-oficial`, `api-alternativa`, `contagem`, `taxas`
