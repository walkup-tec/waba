# LOG — Deploy produção + V02 — Bônus Envios

**Data:** 2026-07-14  
**Pedido:** subir deploy produção (marker personalizado) e atualizar localhost V02.

## Marker
`DEPLOY-2026-07-14-bonus-envios-admin`

## Git
- `origin/master` = `origin/v02` = `a99264a` (feature `18283fa` + fix `run-ts-dev`)
- Assunto deploy: `[f691131] feat: Bônus Envios admin + marker DEPLOY-2026-07-14-bonus-envios-admin`

## Ações
1. Marker em `src/deploy-marker.ts` + `npm run build:h`
2. Commit + push `master` (Deploy FTP + Heal Login)
3. `v02` force-alinhada a `master`
4. V02 local: `npm run dev:v02` → marker OK em `/version-02/health`

## Validar produção
```bash
curl -sS https://waba.draxsistemas.com.br/health
# desejado: deployMarker = DEPLOY-2026-07-14-bonus-envios-admin
```
- Em 14/07 ainda respondia marker antigo `DEPLOY-2026-07-13-bundle-cadastro-cors-docs`
- **Fazer Redeploy Easypanel** do serviço `waba_disparador`
- Após redeploy: ~1 min pode 502 no login até `waba-login-heal` republicar `:30180`

## Validar V02 local
```bash
curl -sS http://localhost:3012/version-02/health
# deployMarker = DEPLOY-2026-07-14-bonus-envios-admin (confirmado)
```
- `node_modules` corrompido no Drive H → `node_modules.__broken_drive`
- `run-ts-dev.cjs` usa `%USERPROFILE%\.waba-h-deps` se package.json local inválido

## Não commitado
- `OnBoarding/*.mp4`
- `node_modules.__broken_drive/`

## Keywords
`bonus-envios`, `DEPLOY-2026-07-14-bonus-envios-admin`, deploy produção, v02, Easypanel redeploy
