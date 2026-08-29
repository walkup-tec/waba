# LOG — Números desconectados constavam como ativos na campanha

## Contexto do pedido

Na campanha, chips desconectados apareciam como ativos (verde).

## Causa raiz

O GET da campanha chama `enrichSelectedCampaignInstancesLive`, que sobrescrevia `connected` com `campaignChipConnectedFromLiveState`. Essa função tratava **probe vazio** e **`connecting`** como ativo. Se o `fetchInstances` já vinha `close` e o `connectionState` falhava (timeout), o chip virava verde.

Há um segundo efeito: ao juntar dois nomes no mesmo rótulo, `connected` usava OR — um match conectado pintava o desconectado de verde.

## Solução

1. Só `open` é ativo na campanha. `connecting` / `close` / vazio sem fallback = não ativo.
2. Probe vazio preserva o `connected` do fetchInstances (`fallbackConnected`).
3. Merge de tags: desconectado vence (AND, não OR).

## Arquivos alterados

- `src/instances/evo-connection-state.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`

## Como validar

1. Selfcheck `evo-connection-state.selfcheck.ts`
2. Após Redeploy: `GET /health` = `DEPLOY-2026-08-29-114800-desconectado-nao-ativo`
3. Chip `close` na Evolution fica vermelho no card da campanha, mesmo se o connectionState atrasar

## Palavras-chave

campanha, chip verde, desconectado, fetchInstances, connectionState, fallbackConnected, connecting
