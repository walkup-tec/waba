# Push GitHub master — Disparo Cloud

## Contexto do pedido

Enviar para o GitHub `master` tudo que o EasyPanel precisa para o usuário fazer o deploy.

## Ações executadas

- Conferir `dist/` no tip e `GITHUB_TOKEN`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Solução implementada

O tip publicado inclui o Laboratório Cloud desta sessão: relatório pelo atendente, ocupação do número, filtro de categoria, campanha Em andamento, colunas depois do template e tabela de histórico no lugar da prévia.

## Arquivos criados/alterados

- `doc/memoria.md`
- este LOG

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador` no EasyPanel. Conferir Actions **Deploy FTP (bundle)** se o workflow disparar.

## Observações de segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, disparo-cloud, deploy
