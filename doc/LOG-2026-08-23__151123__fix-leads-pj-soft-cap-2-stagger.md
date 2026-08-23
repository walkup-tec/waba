# LOG — Leads PJ soft-cap 2 Chromiums + stagger

## Contexto
Paralelo ilimitado derrubava Chromium/container (Target crashed). Mutex N=1 era estável mas lento demais para o objetivo (múltiplas extrações).

## Solução
- Soft-cap **máx. 2** Chromiums simultâneos (CASADOSDADOS_MAX_CONCURRENT_SCRAPES, 1–4)
- Stagger **20s** entre launches (CASADOSDADOS_SCRAPE_STAGGER_MS)
- 3ª+ lista entra na fila com mensagem de progresso; ao liberar vaga, sobe
- Marker: `DEPLOY-2026-08-23-leads-pj-soft-cap-2`

## Arquivos
- `src/marketing/leads-cnpj/waba-leads-cnpj.service.ts`
- `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts` (comentário)
- `src/deploy-marker.ts`

## Validar
1. Redeploy `waba_disparador`
2. `GET /health` → marker soft-cap-2
3. Subir 2–3 listas: no máx. 2 copiando; 3ª em fila; pools devem avançar sem reboot do container

## Keywords
leads-pj, soft-cap, chromium, stagger, parallel-scrape, casadosdados
