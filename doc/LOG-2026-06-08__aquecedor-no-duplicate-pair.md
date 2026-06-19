# LOG — Aquecedor sem mensagem repetida no par

**Data:** 2026-06-08  
**Problema:** drax-sistemas → walkup e walkup → drax-sistemas enviaram o mesmo texto.

## Causa
`pickAquecedorMessageText` evitava só as últimas 50 mensagens **globais**, sem considerar o par de instâncias (ida e volta).

## Correção
- `loadPairUsedAquecedorMessages` — textos já ENVIADOS entre o par (A→B e B→A)
- `loadQueuedAquecedorMessages` — textos PENDENTE/PROCESSANDO na fila
- `buildAquecedorExcludeSet` — união global + fila + par
- `resolveAquecedorMessageForSend` — troca texto da fila se colidir com exclusões do par
- `ensureAquecedorPendingMessage(pair)` — pré-seleciona já pensando no próximo par do ciclo

## Arquivos
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-06-08-aquecedor-no-duplicate-pair`

## Pendências
- Deploy produção + reiniciar aquecedor
