# LOG — Aquecedor: dist/ UI + nextAllowedAt stale

**Data:** 2026-07-16 20:28  
**Marker:** `DEPLOY-2026-07-16-aquecedor-dist-ui-nextallowed`

## Causa

Easypanel/Docker usa **`dist/` do Git** (Dockerfile: `COPY dist`).  
Commit anterior atualizou só `index.html` na raiz → produção continuava com UI antiga (`próximo: 16:02:00` + `lastResult`).

Além disso, `nextAllowedAt` preso no passado (16:02) era reexibido no status.

## Correção

1. Copiar UI nova → `dist/index.html`
2. Commitar `dist/index.js` + `dist/services/aquecedor-owner-runtime.registry.js` (fixes do motor)
3. GET `/aquecedor/status` e POST `/aquecedor/start` zeram `nextAllowedAt` se estiver no passado
4. Marker novo para validar redeploy

## Validar

1. Redeploy Easypanel `waba_disparador`
2. `/health` → marker `…-aquecedor-dist-ui-nextallowed`
3. View-source / hard refresh: deve existir `buildAquecedorRuntimeStatusLine`
4. Status: `próximo: imediato` ou `dd/mm/aaaa - hh:mm:ss` (nunca só `16:02:00`)

## Keywords

`dist`, `Dockerfile`, `index.html`, `nextAllowedAt`, `16:02`, `Easypanel`
