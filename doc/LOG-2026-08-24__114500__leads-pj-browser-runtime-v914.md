# LOG — Leads PJ browser runtime v9.14 (Fases A+B+C)

## Contexto

Chromium em Docker/Xvfb reiniciava (Abrindo Portal → Pesquisando em loop). GPT + evidência: `/dev/shm` 64M, recovery agressivo (`finally browser.close`), lifecycle do browser = lifecycle do job.

## Solução

### Fase A (app)
- Recovery em níveis na paginação (retry → reload → nova Page → hard recover)
- Mensagens `COPY: recover…` para UI permanecer em **Copiando**
- `storageState` em `data/leads-cnpj-casadosdados-storage.json`
- Telemetria JSON a cada N páginas (`CASADOSDADOS_TELEMETRY_EVERY`, default 10)

### Fase B (infra)
- Entrypoint loga `/dev/shm` e avisa se ~64M
- Script VPS: `scripts/waba-leads-pj-shm-swarm.sh status|apply` (tmpfs 2G em `/dev/shm`)
- Com shm grande: env `CASADOSDADOS_USE_DEV_SHM=1` (remove `--disable-dev-shm-usage`)

### Fase C (arquitetura)
- `chromium.launchServer()` + `connect()` — browser compartilhado
- Job fecha só o **Context**; Chromium sobrevive entre jobs
- `releaseSharedBrowser` só em crash hard / abort / shutdown
- `CASADOSDADOS_BROWSER_SERVER=0` volta ao `launch()` legado

## Marker

`DEPLOY-2026-08-24-1145-leads-pj-browser-runtime-v9.14`

## Validar

1. Redeploy imagem `waba_disparador` (Dockerfile/entrypoint mudaram).
2. No VPS: `waba-leads-pj-shm-swarm.sh status` → se 64M, `apply` + `CASADOSDADOS_USE_DEV_SHM=1`.
3. Extração: pills devem ficar em Copiando com `COPY: página N`; recover soft não volta Abrindo Portal.
4. Logs: `LEADS_BROWSER_SERVER`, `LEADS_SCRAPE_TELEMETRY`.

## Docs

- https://playwright.dev/docs/docker
- https://playwright.dev/docs/api/class-browsertype#browser-type-launch-server
