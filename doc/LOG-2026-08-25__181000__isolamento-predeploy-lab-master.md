# Isolamento pré-deploy + hardening LAB Meta

Data: 2026-08-25 18:10 (America/Sao_Paulo)

## Contexto

Fechar proxy Graph legado (`/meta-oficial/*` com token no body), isolar hunks Meta dos arquivos MIXED, validar build do conjunto isolado. Sem commit, push ou deploy.

## Hardening LAB

Guard único `authorizeMetaOficialLabAccess` (alias `authorizeMetaOficialTokenMint`). Helper `rejectUnlessMetaOficialLab` em todos os handlers que mintam token ou chamam Graph com token do browser.

`GET /meta-oficial/embedded-signup/config` permanece público (appId/configId, sem token).

## Isolamento

Worktree `.tmp-meta-isolate` a partir de `HEAD` + arquivos Meta puros + hunks Meta em `src/index.ts`, `src/auth/waba-auth.routes.ts`, `package.json` (só scripts test:meta-*) e patch de `index.html` (17 hunks Meta). Não copia billing/campanhas/Asaas/Evolution.

Build isolado: PASS. `dist/` da working tree mista NÃO é o artefato de deploy Meta.

## Testes

lab-tokens 9; phase2 7; phase3 12; phase5 19; phase6 21; phase7 21; phase8 12; phase9 20. Total 121 PASS / 0 FAIL. Sem Graph real.

## Palavras-chave

meta-oficial lab master-only, authorizeMetaOficialLabAccess, isolate worktree, exchange-code, subscribed_apps
