# LOG — Leads PJ: coluna Pool no histórico

## Contexto

Exibir na tabela do histórico a quantidade de empresas **já copiadas do portal e gravadas no pool** da campanha (não confundir com `Leads` do Excel).

## Solução

- API já devolvia `poolPending` no summary (`toSummary` + `listSummaries`).
- UI (`index.html`): nova coluna **Pool** entre Data gerada e Leads, valor = `poolPending`.

## Como validar

1. Marketing → Leads PJ → histórico.
2. Coluna **Pool** sobe enquanto a raspagem arquiva CNPJs; **Leads** só muda após enriquecimento/Excel.

## Palavras-chave

`leads-pj`, `poolPending`, `histórico`, `coluna pool`, `copiadas`
