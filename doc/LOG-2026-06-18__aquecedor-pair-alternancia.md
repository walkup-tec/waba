# LOG — Aquecedor alternância por par

**Data:** 2026-06-18

## Problema
Instâncias enviavam várias mensagens seguidas na mesma conversa (unilateral), ex.: Soma → Drax ou Walkup disparando várias vezes sem resposta.

## Causa
`ciclo_global` rotacionava todas as combinações A→B sem verificar quem enviou por último no par. A mesma origem podia enviar de novo antes da outra instância responder.

## Correção (`D:\Waba\src\index.ts`)
- `loadRecentAquecedorPairLastSenders()` — último remetente por par (logs_envios / aquecedor)
- `canAquecedorOrigemSendOnPair()` — bloqueia se origem já foi a última a enviar
- `pickAquecedorCombination()` — escolhe só par elegível
- Mensagem sistema/fallback ignorada em `resolveAquecedorMessageForSend`
- Modo teste envia **1** mensagem por ciclo (não mais broadcast)

## Marker
`DEPLOY-2026-06-18-aquecedor-pair-alternancia`

## Deploy
Reiniciar API (`npm run dev:v02`) ou Easypanel produção.
