# LOG — Leads PJ renderer stability v1

## Contexto
Marker soft-cap-2 confirmado no /health; single-job ainda falhava (Target crashed / loop filtros). Soft-cap permanece; foco no renderer + leitura leve + recovery.

## Patch
1. Removidos `--disable-software-rasterizer` e `--renderer-process-limit=2`; mantido `--disable-gpu` + flags leves.
2. `readScreenCards` via `body.innerText` Playwright — sem 8 scrolls artificiais.
3. Paginação confirma `aria-current` / `is-current` primeiro; CNPJ só fallback.
4. Removido `added === 0` → break.
5. Retry classifica crash vs operacional (delay curto em crash).
6. Retomada sequencial limitada a 25 passos (`CASADOSDADOS_MAX_SEQUENTIAL_RESUME_STEPS`).
7. Logs `PAGE_CRASH` / `BROWSER_DISCONNECTED`.
8. Soft-cap 2 intacto no service.

Marker: `DEPLOY-2026-08-23-leads-pj-renderer-stability-v1`

## Validar
Redeploy `waba_disparador` → /health → 1 lista: páginas avançando no pool sem reconectar em loop.
