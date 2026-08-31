# LOG — Leads PJ: piso na retomada rápida + recover (v9.18)

## Contexto

Monitoramento em produção mostrou paginação louca:
- `retomada rápida → pág. 389` com ~1167 CNPJs (piso ~59)
- hops `UI 29 → 55` com métrica ~94
- loop COPY → recover → SEARCH → salto

## Causa

A retomada rápida e o recover usavam `resumeFromPage` cru **antes** do piso do pool.
`goToResultsPage` andava com "next" mesmo com UI à frente do alvo.

## Solução

1. `resolvePortalResumePage(raw, floor)` — raw≫floor → floor; raw≪floor → floor
2. Wrapper recover: piso vivo sobe só com páginas arquivadas; rejeita salto `resumeFrom → +3`
3. Fast resume e `startPage` usam o piso; verifica UI após posicionar
4. `goToResultsPage`: se UI > alvo, só jump DOM (sem next sequencial)
5. Checkpoint: corta só runaway absurdo (`completedPage > volumeFloor + 50`)

## Marker

`DEPLOY-2026-08-24-1335-leads-pj-resume-floor-v9.18`

## Palavras-chave

leads-pj, resumeFloor, retomada-rapida, paginacao, v9.18
