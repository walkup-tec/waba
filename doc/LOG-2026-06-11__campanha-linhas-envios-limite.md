# LOG — Campanha: linhas importadas vs envios contratados

**Data:** 2026-06-11

## Regra de negócio

- Contar linhas da planilha de leads (primeira aba).
- `envios = min(linhas importadas, saldo contratado restante)`.
- Nunca permitir envios acima do pacote.
- Exibir na lista de Campanhas (acima da data de criação):
  - Quantidade de linhas importadas
  - Quantidade de envios

## Alterações

- `waba-campaign-spreadsheet.util.ts` — contagem de linhas.
- `waba-campaign-intake` — grava `importedLineCount`, `plannedSendCount`, consome créditos.
- `POST /disparos/campanhas` — mesma regra no fluxo legado.
- `index.html` — preview no wizard ao importar; card na lista de campanhas.

## Pendências

- Campanhas intake antigas sem os campos mostram 0 até nova geração.
- Reiniciar `npm run dev:v02` para testar.
