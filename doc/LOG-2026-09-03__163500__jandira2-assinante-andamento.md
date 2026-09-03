# LOG — Jandira 2: assinante só vê Em andamento

## Contexto

O disparo Cloud da Campanha Jandira 2 falhou (131053 / weblink 403 em 1159 destinos). O assinante não pode ver o relatório nem os indicadores desse envio. A campanha dele permanece **Em andamento**.

## Solução

Override pontual (`Campanha Jandira 2` em 03/09/2026 e/ou intake `368d053b-d59b-4eed-a235-fe9e9f32c68c`):

- lista e dashboard do assinante: status `in_progress`, rótulo **Em andamento** (não “Coletando relatório da Meta”)
- GET do relatório do assinante recusa como campanha não finalizada
- `tryFinalizeLabIntakeReport` não fecha esta campanha no teto de 2 h
- operacional Lab continua vendo as falhas da Meta

Também vai neste push a correção do weblink do cabeçalho.

## Como validar

```bash
npm run test:campaign-report-overrides
npm run test:broadcast-header
npm run build
```

No painel do assinante: Campanha Jandira 2 = Em andamento, botão Ver Relatório bloqueado.

## Palavras-chave

`jandira 2`, `in_progress`, `andamento`, `holdSubscriberInProgress`, `131053`
