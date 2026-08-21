# Investigação: desconexão 9224 e drax (campanha Seguradoras)

## Contexto

Usuário: os dois números desconectaram de novo; não há restrição da plataforma WhatsApp.

## Ações

- GET Evolution `fetchInstances`, `connectionState`, `proxy/find` (sem sendText).
- GET WABA `/health`, `/disparos/campanhas`, `/instancias/:name/status-conexao`.
- Sem alteração de código, proxy, restart ou QR.

## Achados (2026-08-21 ~14:08 BRT)

| Instância | Número | connectionState | Proxy | Papel |
|---|---|---|---|---|
| `9224` | 555197979224 | **connecting** | ligada | campanha |
| `soma-9224` | 555197979224 | close | off | duplicata |
| `drax` | 555181077770 | **connecting** | ligada | campanha |
| `drax-7770` | 555181077770 | **open** | off | duplicata viva |

- Conta 7770 **não** está banida: `drax-7770` está open.
- Campanha Seguradoras pausada automaticamente: 0/2 conectados.
- `fetchInstances` ainda mostra `open` (fantasma); o estado real é `connectionState`.

## Causa

Dois clientes Baileys no mesmo JID. O WhatsApp derruba uma sessão (conflito), não restrição de envio. A duplicata sem proxy (`drax-7770`) ficou com o link.

## Palavras-chave

desconexão, drax-7770, soma-9224, connectionState connecting, conflito Baileys, proxy, Seguradoras
