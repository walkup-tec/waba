# LOG — Leads PJ state machine v8

## Pedido

Implementar arquitetura definitiva (sem rewrite total): SEARCH fire-and-forget, fases explícitas, recovery só em crash/renderer morto, scrapeCompleted para enrich.

## Mudanças

1. **SEARCH:** removido `locator.click` duplo; `findSearchButtonPoint` + `page.mouse.click`.
2. **waitForSearchTransition:** polling leve 90s + grace 30s; sinais pagination/CNPJ/total/empty/blocked.
3. **rendererProbe** 3s → `RendererUnresponsiveError` = recovery (como Target crashed).
4. **requiresBrowserRecovery** no wrapper; soft failures não reabrem Chromium.
5. **Fases:** BOOT/LOGIN/FILTERS/SEARCH/COPY/DONE; heartbeat mostra `— Ns` na mesma fase (não “persistindo”).
6. **storageState** após login para recovery.
7. **UA Chrome/122 removido** (UA nativo do Chromium).
8. **Oruga:** `aria-current="page"` na leitura de página.
9. **Service:** enrich somente se `scrapeCompleted === true`; incompleto mantém checkpoint e reagenda.
10. Marker: `DEPLOY-2026-08-23-2015-leads-pj-state-machine-v8` (+ dist).

## Validar

1. Redeploy `waba_disparador` → `/health` = marker v8.
2. Corban: `SEARCH: disparando…` → `SEARCH: aguardando — Ns/90s` → `COPY: página 1…` sem novo CNAE.
3. Até página 50: `browserAttempt` implícito 1, pool ~1000, sem “selecionando CNAE” de novo.
