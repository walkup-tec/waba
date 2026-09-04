# Relatório operacional em produção (dist sincronizado)

## Problema

Produção seguia em `DEPLOY-2026-09-03-204500-…`. O heal SSH **não** troca código.

Além disso, os commits do relatório (`61472fb`, `fcf4dcb`) alteraram `index.html` + `src/`, mas o Docker publica **`dist/`**. O `dist/index.html` e o `dist/admin/...service.js` ainda tinham `sendIssues` / “Erros que impactaram o envio”.

## Correção

1. `npm run build` — copia `index.html` → `dist/` e recompila o admin sem `sendIssues`.
2. Marker `DEPLOY-2026-09-04-104000-relatorio-operacional-producao`.
3. Push `master` + rebuild forçado da imagem no VPS (ou Redeploy EasyPanel).

## Validar

`GET https://waba.draxsistemas.com.br/health` → `deployMarker` = `DEPLOY-2026-09-04-104000-relatorio-operacional-producao`.
