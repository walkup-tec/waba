# Push GitHub master — Entregues/Lidos do relatório Meta

## Contexto do pedido

O usuário pediu push para Redeployar no EasyPanel a correção dos indicadores Entregues/Lidos.

## Ações executadas

- Marker `DEPLOY-2026-09-02-193700-relatorio-entregues-lidos`.
- `npm run build` e commit de `dist/`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador`.

Após Redeploy: `GET /health` → `deployMarker` = `DEPLOY-2026-09-02-193700-relatorio-entregues-lidos`.

## Segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, entregues, lidos, relatorio-meta
