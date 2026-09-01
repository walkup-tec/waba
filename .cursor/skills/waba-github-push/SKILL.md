---
name: waba-github-push
description: >-
  Publica commits no GitHub walkup-tec/waba (master) com o Secret GITHUB_TOKEN
  para EasyPanel e Deploy FTP. Use quando o usuário pedir push, deploy, sobe
  para o servidor, EasyPanel, publicar no GitHub, ou quando origin for só Cursor.
---

# Push GitHub WABA (EasyPanel)

## Preferência Rule vs Skill

A **Rule** `.cursor/rules/waba-github-easypanel-push.mdc` (`alwaysApply`) já entra
em todo agente. Esta skill é o playbook completo — leia-a ao executar o push.

## Objetivo

Levar `HEAD` (ou a ref pedida) para:

`https://github.com/walkup-tec/waba.git` → branch **`master`**

sem expor o token e sem achar que push no remoto Cursor basta.

## Checklist

1. `$GITHUB_TOKEN` definido? Se não → setup secret `GITHUB_TOKEN` (Contents Write).
2. Probe blob `POST .../git/blobs` → 201 + `contents=write`.
3. Histórico alinhado a `github/master` (rebase/`git am`/FF). Sem force em `master`
   salvo autorização explícita do usuário.
4. `unset GIT_CONFIG_COUNT GIT_CONFIG_KEY_* GIT_CONFIG_VALUE_*` (evita Authorization duplicado).
5. Rodar `scripts/git-push-github-master.sh` ou o bloco `GIT_ASKPASS` da Rule.
6. `ls-remote` confirma tip; Actions “Deploy FTP (bundle)” costuma disparar.
7. Produção: `curl -sS https://waba.draxsistemas.com.br/health` → `deployMarker`.
8. Documentar em `doc/LOG-…` + `doc/memoria.md`.

## Anti-padrões

- Pedir o PAT no chat.
- Commitar `.env` / token / URL com credencial.
- Empurrar só `origin` Cursor e declarar “deploy feito”.
- Assumir que `permissions.push: true` na API do *usuário* = token com Contents Write
  (olhar `x-accepted-github-permissions`).
