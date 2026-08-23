# LOG — Leads PJ: manter Chromium aberto até fim da cópia

## Contexto

Em produção a extração Corban reiniciava em loop (login → CNAE → “pronto para pesquisar” → queda). No V02 a janela ficava aberta e paginava até o fim.

## Causa raiz (evidência)

- `CASADOSDADOS_SCRAPE_STALL_MS` default **90s** + `shouldAbort` fechava o Chromium se `progressMessage` não mudasse.
- CNAE / Pesquisar / aguardar resultados frequentemente passam de 90s sem “batimento” → `SCRAPE_ABORT_CLOSE` → reconexão completa → demora e pool 0.
- Timeline 2026-08-23: `aguardando resultados` → `Chromium interrompido — recuperando da página 8` → de novo filtros.

## Solução

1. **Stall close desligado por padrão** (`CASADOSDADOS_SCRAPE_STALL_MS` default `0`). Só aborta se o usuário excluir a lista / campanha purgada.
2. **Keepalive** a cada 25s enquanto a sessão Playwright estiver aberta.
3. **Pulse** em “aguardando resultados” (até 180s) sem fechar o navegador.
4. Fechar modal CNAE com timeout curto antes de Pesquisar (evita hang silencioso).
5. `browser.close()` permanece só no `finally` ao terminar a sessão de cópia (ou exclusão).

Marker: `DEPLOY-2026-08-23-leads-pj-keep-browser-until-copy-v1`

## Arquivos

- `src/marketing/leads-cnpj/waba-leads-cnpj.service.ts`
- `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts`
- `src/deploy-marker.ts`

## Validar

1. Push `master` + Redeploy `waba_disparador`.
2. `GET /health` → marker `leads-pj-keep-browser-until-copy-v1`.
3. Extração: progresso deve ir de Abrindo → filtros → Pesquisar → Copiando página N sem “Chromium interrompido” por stall.
4. Pool deve crescer (20/página) sem reabrir login a cada ~90s.

## Opt-in diagnóstico

`CASADOSDADOS_SCRAPE_STALL_MS=90000` reativa o fechamento por demora (não usar em produção normal).
