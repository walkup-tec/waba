# LOG — Leads PJ partial scrape guard

## Problema
Portal Corbans ~8070 empresas; pool parou em 140 e foi para enrich (ReceitaWS 6/140).

## Causa
Retomada (pág. 8) podia devolver `[]` / página sem cards e o service tratava como raspagem OK → limpava checkpoint → `takeFromPool(140)`.

## Fix
- Página vazia no meio → throw (reconectar), não encerrar
- Retomada sem cards → throw (não limpar checkpoint)
- Service: retomada `scraped.length===0` → erro antes de limpar checkpoint
- `POST /admin/marketing/leads-cnpj/:id/resume-scrape` devolve lote ao pool e retoma cópia

Marker: `DEPLOY-2026-08-23-leads-pj-partial-scrape-guard`
