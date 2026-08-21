# Permanência do pareamento na campanha Alternativa

## Contexto

Campanha Seguradoras: os dois números desconectaram. Em 11/08 a integração permanecia.

## Comparação 11/08 vs agora

| Data | Commit | Comportamento |
|------|--------|----------------|
| 11/08 manhã | `886efe2` | Proxy obrigatória; prepare no envio se não ready |
| 11/08 10:17 | `b694d01` | Ativar dispara `proxy/set` em background (corrida com o disparo) |
| 12/08 11:04 | `e886279` | Tick pausa por 50% offline **e desliga Proxy** nesses números |

Com 2 números, um flash `close` (ou EVO lenta) = 50% → desliga proxy nos dois → WhatsApp `device_removed`.

## Correção

- Tick: pausa se precisar; **não** desliga proxy. Sem lista EVO, não pausa.
- Ativar: não faz `proxy/set` nem restart; se `open`, só marca ready.
- Disparo (já em 20/08): não prepare/restart no meio do envio.

## Marker

`DEPLOY-2026-08-21-alternativa-keep-pairing`

## Palavras-chave

Seguradoras, device_removed, proxy/set, e886279, b694d01, pareamento
