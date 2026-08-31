# LOG — Deploy hub Créditos: dist + Easypanel

**Data:** 2026-06-24

## Problema

Usuário reportou tela igual após push `f9b6342`. Produção (`waba.draxsistemas.com.br`) servia HTML antigo.

## Causa raiz

1. **Produção = Docker Easypanel** (`waba_disparador`), não FTP estático.
2. `Dockerfile` copia **`dist/`** do Git — `index.html` raiz não entra na imagem.
3. Commit `f9b6342` alterou só `index.html` + `src/`; **`dist/` não foi commitado**.
4. `/health` permaneceu `deployMarker: DEPLOY-2026-06-21-asaas-monitor-diario`.

## Correção

- `npm run build`
- `src/deploy-marker.ts` → `DEPLOY-2026-06-24-creditos-hub-ui`
- Commit `cb07ab2`: `dist/index.html`, `dist/billing/*`, `dist/deploy-marker.js`
- Push `origin/master`

## Validação pós-redeploy Easypanel

```bash
curl -s https://waba.draxsistemas.com.br/health
# deployMarker deve ser DEPLOY-2026-06-24-creditos-hub-ui

curl -s https://waba.draxsistemas.com.br/ | findstr disparos-credits-hub-page
```

No browser: aba **API Oficial** (menu Créditos) → deve aparecer «Créditos de disparos», saldo por API e histórico acima dos cards.

## Pendência

**Redeploy manual** no Easypanel serviço `waba_disparador` se o Git hook não disparar build automático.
