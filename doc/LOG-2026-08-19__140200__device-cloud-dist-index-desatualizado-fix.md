# Device Cloud UI antiga — dist/index.html desatualizado

## Sintoma

Após push em `master`, produção (`waba.draxsistemas.com.br`) continuava com botão **Aquecer**, **Início** e sem lingueta.

## Evidências

- `GET /health` → `deployMarker: DEPLOY-2026-08-19-125000-welcome-cover-sendmedia` (antigo)
- HTML servido continha `device-cloud-warm-btn` e `Aquecer`
- Git `index.html` (raiz) já tinha lingueta; `dist/index.html` no remoto **não**

## Causa raiz

Produção = **Easypanel Docker** `waba_disparador` → `COPY dist/` (Dockerfile).  
**Não** usa o bundle FTP para a UI principal.

Commits anteriores alteraram só `index.html` na raiz; faltou `npm run build` + commit de `dist/index.html` e `dist/deploy-marker.js`.

## Correção

1. `npm run build` → copia raiz → `dist/index.html`
2. Commit `dist/index.html` + `dist/deploy-marker.js`
3. Push `master` → Easypanel rebuild/redeploy

## Validar

1. `/health` → `deployMarker: DEPLOY-2026-08-19-device-cloud-lingueta-tab`
2. View-source ou curl `/` sem `device-cloud-warm-btn`
3. Dispositivos: lingueta visível; sem Início

## Keywords

dist/index.html, easypanel, waba_disparador, device-cloud lingueta, deploy-marker
