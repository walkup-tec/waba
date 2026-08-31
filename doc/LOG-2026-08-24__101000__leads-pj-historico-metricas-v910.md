# LOG — Leads PJ histórico: páginas / CNPJs / higienizados

## Contexto

Exibir no histórico: páginas avançadas, CNPJs copiados, leads higienizados.

## Solução

API summary (`toSummary` / `listHistory`):
- `pagesDone` / `pagesTotal` — checkpoint `nextPage-1` / `pagesToFetch` (ou estimativa por CNPJs÷20)
- `cnpjCopied` — max(collectedCount, pool pending + used)
- `leadsHigienizados` — `leadCount` se ready; senão contagem de telefones na lista

UI: colunas **Páginas** (`N/M`), **CNPJs**, **Higienizados** (substitui Pool/Leads).

Marker: `DEPLOY-2026-08-24-1010-leads-pj-historico-metricas-v9.10`

## Palavras-chave

`histórico`, `pagesDone`, `cnpjCopied`, `leadsHigienizados`, `v9.10`
