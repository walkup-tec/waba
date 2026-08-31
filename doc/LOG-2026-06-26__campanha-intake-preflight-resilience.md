# LOG — Fix preflight campanha API Oficial bloqueando envio

## Problema

Ao clicar em **Gerar Campanha** (API Oficial), erro: *"Não foi possível verificar o servidor. Tente novamente em alguns segundos."* — mesmo com backend saudável ou com falha transitória (deploy/rede).

## Causa

`assertCampaignIntakeBackendReady()` falhava na **primeira** falha de `GET /health` (timeout, 502, rede) e **bloqueava** o POST multipart, que já tinha retry próprio.

## Solução

1. `fetchCampaignIntakeBackendStatusWithRetry` — até 6 tentativas com backoff.
2. Bloqueio **somente** quando confirmado: backend desatualizado (`safeParser`/`apiVersion`), `shuttingDown` ou `maintenanceMode`.
3. Falha transitória de health (rede/gateway) → **não bloqueia**; segue para `POST /disparos/campanhas/intake` com retry.
4. Botão mostra "Verificando servidor…" durante preflight.
5. Marker `DEPLOY-2026-06-26-campanha-intake-preflight-resilience`.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. Gerar campanha API Oficial em produção após deploy.
2. Durante redeploy breve: preflight retenta ou envia direto; não exibir mensagem genérica de verificação.

## Palavras-chave

`campanha`, `preflight`, `health`, `API Oficial`, `intake`, `verificar servidor`
