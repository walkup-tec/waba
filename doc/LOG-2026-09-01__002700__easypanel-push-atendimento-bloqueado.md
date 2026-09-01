# LOG — Push EasyPanel do atendimento Meta ainda bloqueado neste agente

## Contexto do pedido

O usuário pediu para enviar o push que o EasyPanel usa para deploy. Produção continua no marker antigo do select de origem.

## O que estava no ar (evidência)

`GET https://waba.draxsistemas.com.br/health`

- `deployMarker`: `DEPLOY-2026-08-31-221500-meta-cloud-lab-origem`
- GitHub `master`: `949b8e3` — `feat(meta): select de origem no teste de envio Cloud API`

Isso confirma que o patch aplicado no Windows foi só o select de origem. O atendimento unificado **não** está no GitHub.

## Por que este agente não empurra o GitHub

Remoto `github` = `https://github.com/walkup-tec/waba.git`. Sem `GITHUB_TOKEN` / PAT, `git push github HEAD:master` falha:

`fatal: could not read Username for 'https://github.com'`

O push deste Cloud Agent vai só para `origin.cursor.com`. O EasyPanel **não** observa esse remoto.

## O que falta no GitHub (já validado com `git am` em clone limpo de `master`)

1. `fix(meta): Inbox usa verified_name atual da Meta`
2. `feat(meta): atendimento unificado estilo chatbot`

Marker esperado após deploy: `DEPLOY-2026-09-01-001200-meta-atendimento-chat`

Patch canônico: `scripts/deploy-atendimento-meta.patch` (aplica limpo sobre `949b8e3`).

Script Windows: `scripts/push-atendimento-github.ps1`

## Como validar depois do push

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

O JSON deve ter `deployMarker` = `DEPLOY-2026-09-01-001200-meta-atendimento-chat`. Se ainda for `...-meta-cloud-lab-origem`, o EasyPanel não recebeu o commit novo.

## Palavras-chave

easypanel, github-master, push, atendimento, deploy-marker, GITHUB_TOKEN

## 2026-09-01 00:31 — Secret chegou; Contents ainda Read-only

- `GITHUB_TOKEN` fine-grained presente (`github_pat_…`, user `walkup-tec`).
- `GET /repos/walkup-tec/waba` → 200; campo `permissions.push` do *usuário* é true (não reflete o token).
- Header real do token: `x-accepted-github-permissions: contents=read`.
- `POST /git/blobs` → 403 `Resource not accessible by personal access token` (exige `contents=write`).
- Commits locais prontos em `push-easypanel-atendimento` / tip `e4b85ef` (Inbox + Atendimento + helpers), base `949b8e3`.
- Aguardando PAT com **Contents: Read and write** para `git push` em `master`.

