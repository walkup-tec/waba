# Evolution — confirmação de entrega (reutilizável)

## Problema recorrente

`sendText` retorna HTTP 2xx e o app WhatsApp do destino recebe a mensagem, mas `POST /chat/findMessages/{destino}` **não** encontra o texto a tempo (ou nunca, em chats `@lid`).

Sintoma típico no produto: “mensagem apareceu só na origem”.

## Causas comuns

- Histórico Evolution indexado por `@lid` em vez de JID telefone
- Atraso de sync Baileys no destino vs histórico local da origem (`fromMe: true` aparece primeiro)
- Variantes BR do número (9º dígito / DDI 55) no `remoteJid` da consulta

## Padrão seguro de confirmação

1. Tag única por envio (não reutilizar prefixo de frase fixa — gera falso sucesso no histórico).
2. Preferir prova no **destino** (`findMessages` + fallback `findChats` / lastMessage).
3. Aceitar ACK de aparelho: `DELIVERY_ACK`, `READ`, `PLAYED` (via `findStatusMessage` / `MessageUpdate`).
4. **Não** tratar `SERVER_ACK` sozinho como entregue no aparelho.
5. `ERROR` / `FAILED` no ACK da origem = falha de sessão de envio (não culpar o destino).

## O que evitar

- Confirmar só porque a origem tem `fromMe: true`
- Confirmar por substring do texto genérico sem tag única
- Janelas de polling muito curtas em instâncias `@lid-heavy`
