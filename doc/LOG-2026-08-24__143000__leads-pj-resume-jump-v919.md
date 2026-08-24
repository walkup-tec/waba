# LOG — Leads PJ retomada pág. alta sem hard-fail (v9.19)

## Contexto

Campanha Corban falhou em **Copiando** com:

`Renderer não responde durante COPY resume: não posicionou na pág. 104 (UI 41)`

Progresso do pool parava ~página 103 (~2061 CNPJs). A UI Oruga, após SEARCH, ficava numa janela baixa (ex.: 41); o salto para 104 falhava e o código tratava isso como renderer morto → reconnect / loop CNAE.

## Causa raiz

1. Teto sequencial de retomada efetivamente baixo (`CASADOSDADOS_MAX_SEQUENTIAL_RESUME_STEPS` / default 12) — de UI 41 não dava para chegar em 104.
2. Falha de posicionamento lançava `RendererUnresponsiveError` (hard reconnect), embora o Chromium estivesse vivo.

## Solução

Arquivo: `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts`

1. `jumpToPageDom` com timeout Node + setter nativo do input + confirmação `waitUntilPage`.
2. `hopTowardPageDom` — clica o maior botão numérico visível `> current` e `≤ target`.
3. `goToResultsPage` — jump → hop → next, com `maxSteps = min(400, max(distância+15, env))` (env só aumenta o teto).
4. Se o salto ainda falhar: **adotar a página atual da UI** e continuar (pool deduplica). **Não** lançar `RendererUnresponsiveError` por falha de jump.

Marker: `DEPLOY-2026-08-24-1436-leads-pj-resume-jump-v9.19`

## Validação

- `npx tsc` OK.
- Evidência funcional em produção: após Redeploy, Corban deve passar de ~2061 no pool / avançar além da pág. 104 sem falha “UI 41”; `/health` com marker v9.19.

## Palavras-chave

`leads-pj`, `resume`, `página 104`, `UI 41`, `Oruga`, `jumpToPageDom`, `RendererUnresponsiveError`, `v9.19`
