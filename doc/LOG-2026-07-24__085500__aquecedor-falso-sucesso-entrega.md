# LOG — Aquecedor: falso «Envio com Sucesso» sem mensagem no WhatsApp

**Data:** 2026-07-24  
**Marker:** `DEPLOY-2026-07-24-aquecedor-falso-sucesso-entrega`

## Contexto

Painel **Envios** listava pares (ex.: `1261 → Final-2477`, `1321 → 1261`) como **Envio com Sucesso**, mas nos aparelhos físicos as mensagens **não foram enviadas nem recebidas**.

## Causa

A confirmação `verifyAquecedorMessageDelivered` aceitava falso positivo:

1. Busca por **prefixo** do texto (`fullText.slice(0, 48)`) — frases do aquecedor se repetem no histórico EVO.
2. `findMessages` **global** (`{}` / `{ limit: 80 }`) sem `remoteJid`.
3. Sucesso só com match no **destino**; bastava histórico antigo.
4. Ciclo **teste** gravava sucesso mesmo quando `findMessages` falhava («EVO aceitou»).

## Correção

- Needle = **tag única** de entrega (não o prefixo da frase).
- `findMessages` só com `remoteJid` (sem probe global).
- Sucesso exige tag na **origem** (`fromMe`) **e** no **destino**.
- Ciclo teste **não** grava `logs_envios` / «Envio com Sucesso» sem prova.

## Arquivos

- `src/index.ts` / `dist/index.js`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`

## Validar

1. `node scripts/test-aquecedor-delivery-verify.cjs` → todos OK (cenário histórico = sem sucesso).
2. Redeploy Easypanel `waba_disparador`.
3. `/health` → marker `DEPLOY-2026-07-24-aquecedor-falso-sucesso-entrega`.
4. Próximo ciclo: se o WhatsApp real não receber, o painel **não** deve marcar sucesso; `lastResult` deve citar confirmação falha.
5. Se vários ciclos falharem: checar `connectionState` live das instâncias (ghost-open).

## Palavras-chave

`aquecedor`, `falso sucesso`, `findMessages`, `delivery tag`, `Envio com Sucesso`, `ghost`
