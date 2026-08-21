# LOG — Playwright Chromium no Docker (Leads PJ)

## Contexto
Em produção, raspagem falhava com `browserType.launch: Executable doesn't exist at /home/nodejs/.cache/ms-playwright...`.

## Causa
Imagem Alpine sem browsers do Playwright; `npm ci` instala o pacote, mas não o Chromium.

## Solução
- Dockerfile: `node:20.18-bookworm-slim` + `npx playwright install --with-deps chromium`
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`
- Args `--no-sandbox` / `--disable-dev-shm-usage` no launch
- Marker `DEPLOY-2026-08-14-playwright-chromium-docker`

## Impacto
- Build da imagem mais lento/maior (Chromium + deps)
- Serviço afetado: `waba_disparador`
- Rollback: reverter commit do Dockerfile

## Validação
Após Redeploy EasyPanel: `/health` com marker novo; nova lista Leads PJ deve passar de "Abrindo Portal".

## Keywords
playwright, chromium, docker, leads-pj, easypanel
