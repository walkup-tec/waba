# Validação CONFIRMAR — detecção rápida (5182007943)

## Contexto

Integração da instância **5182007943** concluída com sucesso, porém a etapa de recepção de **CONFIRMAR** demorou muito.

## Causa raiz

1. **`resolveInboundHit` iniciava por `findChats`** — até 20 chats × 3 URLs × 2 bodies = dezenas/centenas de chamadas HTTP **sequenciais** antes do `findMessages` global.
2. **Cada ciclo do loop backend** (~450ms) repetia o scan pesado inteiro.
3. **Frontend alternava `?nudge=2` a cada 500ms**, disparando outro scan agressivo em paralelo ao loop.
4. Timeout de `findMessages` em 15s podia segurar cada ciclo em falhas transitórias.

Webhook (quando configurado) já era instantâneo; o gargalo era o polling Evolution.

## Solução

### Fast path primeiro (`instance-inbound-validation.service.ts`)

- `findInboundViaApiFast`: 2 URLs em **paralelo** (`Promise.all`), bodies leves (`fromMe:false`, `limit:60`), timeout 8s.
- `deep` (findChats + API estendida) só a cada **5 ticks** do loop ou via `?nudge=1` / `?nudge=2`.
- `findChats` limitado a **8** chats, 1 URL de mensagens por chat.
- Poll do loop: **280ms** (env `INBOUND_VALIDATION_POLL_MS`).

### Frontend (`index.html`)

- Poll **300ms** só lê status (sem scan pesado na maioria dos ticks).
- `?nudge=1` (deep) a cada **10** polls (~3s).
- Botão **「Já enviei CONFIRMAR」** mantém `?nudge=2` (agressivo).

### Marker

`DEPLOY-2026-07-01-validacao-confirmar-fast-detect`

## Arquivos

- `src/instance-inbound-validation.service.ts`
- `src/index.ts`
- `index.html`, `dist/*`
- `src/deploy-marker.ts`

## Validar

1. Passo 3: enviar CONFIRMAR → recepção OK em poucos segundos (webhook ou fast path).
2. Sem CONFIRMAR → não marcar OK (timestamp estrito do commit anterior).
3. `/health` → novo `deployMarker` após redeploy Easypanel.

## Palavras-chave

`validacao-inbound`, `CONFIRMAR`, `fast-detect`, `findChats`, `5182007943`, `INBOUND_VALIDATION_POLL_MS`
