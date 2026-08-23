# LOG — Leads PJ resume on stall/crash

## Pedido
Se travar ou cair na cópia, retomar de onde parou.

## Fix
- Checkpoint salvo **antes** de abrir o portal (página de retomada)
- Watchdog: sem progresso por 90s fecha Chromium (`CASADOSDADOS_SCRAPE_STALL_MS`)
- Catch: qualquer falha em scraping reconecta com `nextPage` = checkpoint ou `floor(pool/20)+1`
- Pool já arquivado é preservado

Marker: `DEPLOY-2026-08-23-leads-pj-resume-on-stall-v1`
