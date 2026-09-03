# LOG — Cancelar o Disparo Cloud da Jandira 2 para refazer

## Contexto

O usuário vai refazer a campanha. O POST Cloud `26d33b09-…` (1159 × 131053) bloqueava o vínculo e ocupava o número, porque o status era `done` (Graph aceitou) e o intake ficou `in_progress`.

## Solução

No boot do disparador, `ensureVoidedFailedCloudBroadcasts` cancela esse lote (`voidedAt`, status `failed`):

- some da ocupação do número
- a campanha do assinante volta à lista do Disparo Cloud
- o histórico mostra **Cancelado**
- o intake do assinante **não** é cancelado (continua Em andamento)
- se um disparo novo tiver entrega, o hold do relatório do assinante sai

Também neste tip: weblink do cabeçalho e hold Em andamento.

## Como validar

```bash
npm run test:broadcast-header
npm run test:meta-lab-report
npm run test:campaign-report-overrides
npm run build
```

Após Redeploy: Disparo Cloud lista Campanha Jandira 2; número disponível; linha antiga = Cancelado.

## Palavras-chave

`voidedAt`, `26d33b09`, `jandira 2`, `cancelar`, `refazer`
