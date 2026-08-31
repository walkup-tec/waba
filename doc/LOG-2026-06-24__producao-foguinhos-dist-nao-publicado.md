# LOG — Produção sem coluna foguinho (dist não publicado)

## Causa raiz

- Código em `src/` + `index.html` já estava em `master` (commits `1510202`, `051a31a`).
- **`dist/` não foi commitado** após o build; Easypanel/Docker copia `dist/` do Git **sem** rodar `tsc`.
- `/health` em produção: `DEPLOY-2026-06-22-instancias-filtros-ordem-ui` (desatualizado).

## Correção

- `npm run build` local
- Commit `dist/index.html`, `dist/index.js`, `dist/deploy-marker.js`, `dist/services/aquecedor-instance-warmth.service.js`
- Marker: `DEPLOY-2026-06-24-instancias-foguinhos-producao-dist`
- Push `master` → Actions FTP + redeploy Easypanel

## Validar

`curl https://waba.draxsistemas.com.br/health` → novo `deployMarker`  
Instâncias → coluna **Quente** (primeira coluna, foguinhos 0–3).
