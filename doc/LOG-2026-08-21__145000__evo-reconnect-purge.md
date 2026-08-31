# LOG — Reconexão: purge EVO antigo (preservar foguinhos e totais)

## Contexto do pedido

Quando um número conectar de novo, apagar tudo que existia dele na Evolution e resquícios no WABA, **exceto** foguinhos e total de mensagens enviadas. Rodar agora nos dois números da campanha Seguradoras (`9224` / `drax`) e deixar a regra no sistema.

## Ações

1. Serviço `collectEvoInstancesSharingPhone` + `purgeOldEvoSessionsForReconnect`.
2. Hook no QR (`runRegistrarQrcode` / `softResetDisconnectedEvoInstanceForQr`).
3. `POST /instancias/:name/reconnect-purge`.
4. Limpeza imediata na Evolution dos clones `soma-9224` e `drax-7770` e reset das sessões `9224` e `drax`.
5. Cursor rule `.cursor/rules/evo-reconnect-purge.mdc`.

## Como validar

- `fetchInstances`: só um nome por JID (`9224` e `drax`).
- Lifecycle/foguinhos e `logs_envios` dos nomes canônicos intactos.
- Reconexão futura gera instância EVO vazia (sem chats antigos).

## Segurança

Sem `sendText`. Sem log de `EVO_API_KEY`.

## Palavras-chave

reconnect-purge, clone EVO, soma-9224, drax-7770, foguinhos, logs_envios
