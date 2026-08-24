# LOG — Leads PJ Excel somente celular v9.8

## Pedido

Arquivo Excel e contagem de leads só com número de celular; sem linhas sem telefone.

## Causa

`expandLeadsByMobileForEvo` mantinha 1 linha com `Telefone` vazio quando não havia móvel EVO válido.

## Correção

- Sem celular → CNPJ **omitido** (não entra no Excel nem no `leadCount`)
- `buildLeadsCnpjExcelBuffer` filtra de novo por telefone não vazio
- Mensagens de progresso: «linha(s) com celular»

## Marker

`DEPLOY-2026-08-24-0730-leads-pj-excel-somente-celular-v9.8`

## Validação local

Node: lead com tel vazio/fixo omitido; móvel vira 1+ linhas EVO; `leadCount ===` linhas com telefone.

## Nota

Listas `ready` já geradas (ex. Corban 142) não regeneram sozinhas — novo enrich/rebuild aplica a regra.

## Palavras-chave

leads-pj, excel, somente-celular, expandLeadsByMobileForEvo, v9.8
