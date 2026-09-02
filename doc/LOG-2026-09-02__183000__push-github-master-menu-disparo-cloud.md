# Push GitHub master — menu Disparo Cloud

## Contexto do pedido

O usuário autorizou publicar o menu **Disparo Cloud** (Laboratório, acima de Automação) no GitHub `master` para o EasyPanel.

## Ações executadas

- Marker `DEPLOY-2026-09-02-183000-menu-disparo-cloud`.
- `npm run build` e commit de `dist/`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Solução implementada

O tip publicado inclui o menu `whatsapp-disparo-cloud` na seção Laboratório, acima de Automação. O wizard não fica mais na aba Templates.

## Arquivos criados/alterados

- `src/deploy-marker.ts`
- `dist/deploy-marker.js`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`
- este LOG

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador`. Conferir Actions **Deploy FTP (bundle)** se o workflow disparar.

Após Redeploy: `GET /health` → `deployMarker` = `DEPLOY-2026-09-02-183000-menu-disparo-cloud`. Seção Laboratório deve mostrar **Disparo Cloud** acima de Automação.

## Observações de segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, menu-disparo-cloud, laboratorio, deploy
