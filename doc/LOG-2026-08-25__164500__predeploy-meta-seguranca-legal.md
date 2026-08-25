# Pré-deploy segurança Meta Tech Provider

Data: 2026-08-25 16:45 (America/Sao_Paulo)

## Contexto

Fechar riscos críticos antes de autorizar deploy das Fases 5–10. Sem commit, push, deploy, App Review ou alteração no painel Meta.

## Decisão — rotas legado de token

LAB é um **menu** no mesmo app de produção. Não existe profile/LAB isolado confiável. Autorização = **somente MASTER** (role de sessão `master` **ou** e-mail `WABA_ADMIN_EMAIL`).

## Alterações

- Guard `authorizeMetaOficialTokenMint` nas rotas `POST /meta-oficial/tokens/app-access` e `POST /meta-oficial/tokens/system-user-access`.
- Páginas públicas `public-pages/termos.html` e `public-pages/exclusao-de-dados.html`, rotas sem login.
- Bypass de auth para `/termos`, `/exclusao-de-dados`, `/exclusao`.

## Não feito nesta etapa

- Restringir `/meta-oficial/embedded-signup/exchange-code` (ainda devolve token a qualquer sessão autenticada — risco residual App Review).
- Callback técnico Data Deletion da Meta (não existia; não inventado).
- Correção do `npm run build` (erros pré-existentes em `src/index.ts` + locks em `dist/`).

## Palavras-chave

pre-deploy, master-only, tokens legado, termos, exclusao-de-dados, App Review
