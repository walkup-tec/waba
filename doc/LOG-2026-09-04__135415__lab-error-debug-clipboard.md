# LOG — Clipboard de evidências de erro no Laboratório Meta

## Contexto
Quando o Laboratório Meta falha (IA, listagem, sync, delete, disparo Cloud, automação), o operador precisa copiar evidências sanitizadas e colar no chat para diagnóstico.

## Solução
1. Painel de debug embutido no modal de IA (`#meta-tpl-ai-debug-panel`) e no modal de exclusão (`#meta-tpl-delete-debug-panel`).
2. Modal standalone `#meta-tpl-lab-debug-overlay` quando não há modal de erro aberto.
3. `metaTplLabFetchJson` anexa `error.labEvidence` (path, method, httpStatus, code, request/response sanitizados).
4. `metaTplLabPresentError` monta o clipboard e escolhe o destino (AI / delete / standalone).
5. Botão **Copiar evidências** (clipboard API + fallback `execCommand`).
6. Segredos (`access_token`, Bearer, etc.) são redigidos antes de exibir.

## Arquivos
- `index.html` — UI + JS do clipboard
- `src/deploy-marker.ts` — `DEPLOY-2026-09-04-141500-lab-error-debug-clipboard`

## Como validar
1. Redeploy EasyPanel do `waba_disparador`.
2. `GET /health` → `deployMarker` = `DEPLOY-2026-09-04-141500-lab-error-debug-clipboard`.
3. Forçar erro no Lab (ex.: gerar IA sem portfólio inválido / sync com falha / submit com mídia recusada).
4. Conferir modal com textarea + **Copiar evidências**.
5. Colar o bloco e confirmar ausência de tokens.

## Segurança
Não logar nem copiar `access_token`, `app_secret`, `verify_token` ou Bearer.

## Keywords
lab-error, debug-clipboard, meta-tpl-lab-debug, evidencias, copiar-erro, meta-lab
