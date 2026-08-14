# LOG — verify welcome routing + deploy marker

## Pedido
Commit/push para deploy; validar regras boas-vindas antes de publicar.

## Validação executada
- `npm run build` OK
- `npm run verify:welcome-routing` OK (estático + EVO live drax-oficial open)

## Regras checadas no código
- `ignoreAquecedorLifecycle` em boas-vindas
- `resolveWelcomeEvoSendSlots`: eleito mesmo em pausa; failover só se desconectado
- ACK erro não troca instância

## Marker pós-deploy
`DEPLOY-2026-08-14-welcome-eleito-pausa-failover-offline`

## Pós-deploy (usuário)
1. GET /health → marker acima
2. Reenviar boas-vindas com 7770 em pausa humana → log/Evolution só `drax-oficial`
