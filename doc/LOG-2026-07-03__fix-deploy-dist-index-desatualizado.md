# Fix deploy Docker — dist/index.html desatualizado

## Problema

Commit `b16f917` alterou `index.html` na raiz com todas as features de UI, mas `dist/index.html` no Git só recebeu meta OG — produção Easypanel serve `dist/index.html` (Docker `COPY dist`).

## Causa

`npm run build` não foi executado antes do commit das mudanças de UI. Dockerfile também não copiava `public-pages/` (vendas/cadastro OG).

## Solução

1. `npm run build` — `dist/index.html` sincronizado com raiz.
2. `Dockerfile` — `COPY public-pages ./public-pages`.
3. `deploy-marker.ts` — `DEPLOY-2026-07-03-sync-dist-index-html-docker-public-pages`.

## Validar

- `/health` → `deployMarker` novo após redeploy.
- Admin assinantes: ícones inline na tabela.
- Cupons: «Válido até» na mesma linha.
- Sidebar fixa ao rolar.

## Palavras-chave

`dist/index.html`, `copy-index-html`, Dockerfile, Easypanel
