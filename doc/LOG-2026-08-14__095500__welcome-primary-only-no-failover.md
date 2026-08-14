# LOG — Boas-vindas sempre pelo número eleito (5181077770)

## Contexto

Regra de negócio: boas-vindas devem sair pelo número designado (`5181077770` / `drax-oficial`), **mesmo em pausa humana ou Preparando**. Não fazer failover para `5197462102` só porque o primário está em pausa ou ACK demorou.

## Causa

1. Sequência usava primário → secundário → terciário; falha de ACK no primário disparava envio pelo secundário.
2. `allowAnyOpenFallback` estava ligado para `ignoreAquecedorLifecycle`, podendo escolher outra instância.
3. Catálogo Evolution com `isOpen: false` (stale) ignorava `drax-oficial` mesmo com sessão live open.

## Solução

- Com `ignoreAquecedorLifecycle` (boas-vindas): **só o hint primário**.
- Sem failover para secundário/terciário nem “qualquer open”.
- ACK pendente/erro: **repete no mesmo número** (retorna recoverable), não troca instância.
- `resolveConnectedEvoInstanceByPhoneHint`: modo `verifyLiveIfCatalogClosed` consulta `connectionState` live.

## Arquivos

- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `src/push/waba-push-community.service.ts`
- `src/deploy-marker.ts`

## Validar

Redeploy + reenviar boas-vindas com `5181077770` em pausa humana → log deve mostrar `drax-oficial` e **não** secundário.

## Palavras-chave

boas-vindas, pausa humana, 5181077770, primary-only, failover
