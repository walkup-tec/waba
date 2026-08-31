# LOG — Leads PJ search discovery v9.1

## Evidência v9

`SEARCH_DISPATCH_FAILED` com `btn=false/0` — matcher exact `"pesquisar"|"buscar"` não achava CTA.
Soft path OK (sem LOGIN reconnect).

## v9.1

1. Candidatos amplos: button/a/role/input/tabindex/class button|btn
2. Match `includes(pesquisar|buscar)` em text + aria + title + value
3. Scoring + maior área; passagem 2 sobe ancestral de SPAN
4. `SEARCH_BUTTON_NOT_FOUND` vs `SEARCH_DISPATCH_FAILED`
5. Dump `SEARCH_ACTION_DUMP` (30 actions + textos pesq|busc) no log quando count=0
6. iframeCount/srcs no probe
7. Marker: `DEPLOY-2026-08-23-2145-leads-pj-search-discovery-v9.1`

## Validar

Redeploy → `SEARCH: snapshot — btn=true/N · #1 BUTTON text=...` → ACK → COPY.
Se `btn=false/0`: olhar logs do container por `SEARCH_ACTION_DUMP`.
