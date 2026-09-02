# Push GitHub master — override Campanha Jandira (981 / 431)

## Contexto do pedido

O usuário pediu marker deste push e subir para o servidor (GitHub `master` / EasyPanel).

## Ações executadas

- Marker `DEPLOY-2026-09-02-201800-jandira-981-431`.
- `npm run build` e commit de `dist/`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Solução publicada

Leitura só deste disparo (Campanha Jandira, 1.990 / 1.156 / 2): Entregues 981, Lidos 431, sem cliques. Webhook e fechamento Meta não mudam.

## Arquivos

- `src/deploy-marker.ts`
- `dist/deploy-marker.js`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`
- este LOG

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador`. Conferir Actions **Deploy FTP (bundle)** se o workflow disparar.

Após Redeploy: `GET /health` → `deployMarker` = `DEPLOY-2026-09-02-201800-jandira-981-431`. Relatório Jandira: 981 entregues, 431 lidos, sem cliques.

## Segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, jandira, 981, 431, deploy-marker
