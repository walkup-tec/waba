# LOG — Leads PJ CTA fast probe v9.5

## Contexto

Screenshot de falha: status **Falhou** com mensagem

`Probe pré-clique não respondeu em 8s (CDP/DOM travado).`

UI pode mostrar stepper em «Abrindo Portal», mas o erro vinha do pré-clique em **SEARCH** (`dispatchSearchWithAck`).

## Causa

`dispatchSearchWithAck` ainda chamava `probeSearchState` completo com `withNodeTimeout(..., 8000)`.

Esse probe é pesado (scan de nós/CNPJs). Com CDP ocupado/zumbi, o evaluate não completa → timeout Node → throw tratado como **soft** (`SEARCH_BUTTON_NOT_FOUND` / `same-page`) → job **failed** sem reopen de Chromium.

## Solução

1. `findSearchButtonCandidatesFast` — só controles clicáveis (`button`/`a`/`role=button`/submit), sem varrer 2500 ancestrais.
2. Pré-clique usa fast (5s Node). Se timeout → `LeadsScrapeError("CDP_PROBE_TIMEOUT", "new-browser", …)`.
3. Se fast=0 candidatos → fallback `findSearchButtonCandidates` (6s). Timeout → também `new-browser`.
4. Botão realmente ausente (probe OK, `btn=false`) → continua soft `SEARCH_BUTTON_NOT_FOUND`.
5. Service: `CDP_PROBE_TIMEOUT` no regex de hard recovery (cinto).

## Arquivos

- `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts` (+ dist)
- `src/marketing/leads-cnpj/waba-leads-cnpj.service.ts` (+ dist)
- `src/deploy-marker.ts` (+ dist)

## Marker

`DEPLOY-2026-08-23-2250-leads-pj-cta-fast-probe-v9.5`

## Validação

1. Push + Redeploy `waba_disparador`.
2. `GET /health` → `deployMarker` com `…cta-fast-probe-v9.5`.
3. Rodar Corban: após Escape/filtros, progresso deve mostrar `descoberta rápida do CTA (fast)` e snapshot `btn=…`.
4. Se CDP travar de verdade: reconnect Chromium (CRASH_RECOVER / LOGIN checkpoint), **não** pause soft com a mensagem antiga de «Probe pré-clique…8s».

## Palavras-chave

leads-pj, CDP_PROBE_TIMEOUT, findSearchButtonCandidatesFast, pre-click, SEARCH, soft-vs-hard, v9.5
