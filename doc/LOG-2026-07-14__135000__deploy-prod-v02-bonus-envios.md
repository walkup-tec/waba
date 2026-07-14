# LOG — Deploy produção + V02 — Bônus Envios

**Data:** 2026-07-14  
**Pedido:** subir deploy produção (marker personalizado) e atualizar localhost V02.

## Marker
`DEPLOY-2026-07-14-bonus-envios-admin`

## Ações
1. Atualizar `src/deploy-marker.ts`
2. `npm run build:h` (dist + index)
3. Commit + push `origin/master` (Deploy FTP + Easypanel)
4. Branch `v02` alinhada ao master (paridade código)
5. Ambiente local V02: build + `npm run dev:v02` se necessário

## Validar produção
```bash
curl -sS https://waba.draxsistemas.com.br/health
# deployMarker = DEPLOY-2026-07-14-bonus-envios-admin
```
- Redeploy Easypanel `waba_disparador` se o marker ainda não atualizou
- Se login 502 após redeploy: heal watch/timer (regra login-heal)

## Validar V02 local
```bash
curl -sS http://localhost:3012/version-02/health
```

## Não commitado
- `OnBoarding/*.mp4` (vídeo pesado)

## Keywords
`bonus-envios`, `DEPLOY-2026-07-14-bonus-envios-admin`, deploy produção, v02
