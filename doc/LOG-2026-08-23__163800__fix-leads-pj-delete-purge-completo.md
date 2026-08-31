# LOG — Leads PJ delete purge completo

## Pedido
Ao excluir extração, limpar todo resquício para não atrapalhar futuras.

## Antes
deleteList já apagava listas/Excel/pool/fila, mas:
- slot Chromium podia ficar ativo (soft-cap bloqueava outras)
- checkpoint async podia `mergePool` e recriar o pool após delete

## Agora
- `forceReleasePortalScrapeSlot` + cancel phone refresh
- `purgedCampaignKeys` bloqueia recreate até novo `createAndStart`
- checkpoint/merge aborta se lista excluída ou campanha purgada
- deletePool em dupla passada + `armGlobalEnrichQueue`

Marker: `DEPLOY-2026-08-23-leads-pj-delete-purge-v1`
