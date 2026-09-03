# Push GitHub master — linha do tempo visual

## Contexto do pedido

O usuário pediu push para fazer o deploy (GitHub `master` / EasyPanel).

## Ações executadas

- Marker `DEPLOY-2026-09-03-135600-relatorio-timeline-visual`.
- `npm run build` e commit de `dist/`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Solução publicada

Relatório do assinante: linha do tempo em trilha de pontos (horizontal no desktop, vertical no celular).

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador`. Conferir Actions **Deploy FTP (bundle)** se o workflow disparar.

Após Redeploy: `GET /health` → `deployMarker` = `DEPLOY-2026-09-03-135600-relatorio-timeline-visual`.

## Segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, timeline, linha do tempo, deploy-marker
