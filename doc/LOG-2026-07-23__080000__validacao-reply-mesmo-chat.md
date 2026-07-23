# LOG — Validação: reply no mesmo chat do CONFIRMAR

## Contexto

Modal de validação conclui OK, mas a mensagem final `Validação WABA concluída. WABA-VAL:…` não aparece no WhatsApp (número integrado / conversa do CONFIRMAR).

## Causa

1. `sendText` tentava variantes BR (com/sem 9º dígito); a EVO podia aceitar HTTP OK no JID “errado”.
2. `findReplyInChat` buscava `fromMe` **global** e `{ limit: 100 }` — encontrava a mensagem em outro chat e marcava sucesso falso.
3. Prova não exigia `fromMe === true` estrito (aceitava `fromMe` indefinido).

## Solução

- Guardar `inboundChatJid` do CONFIRMAR.
- Priorizar envio para o número/JID exato desse chat.
- Provar reply **só** nesse chat (`fromMe: true`); remover varredura global.
- Antes de enviar: garantir instância `open`.
- Marker: `DEPLOY-2026-07-23-validacao-reply-mesmo-chat`

Doc EVO sendText / chat findMessages.

## Arquivos

- `src/instance-inbound-validation.service.ts`
- `dist/instance-inbound-validation.service.js`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`

## Validar

1. Redeploy Node + confirmar marker no `/health`.
2. Integrar instância → CONFIRMAR do outro WA → mensagem `Validação WABA concluída…` no **mesmo** chat.
3. UI só fecha sucesso com prova nesse chat.

## Palavras-chave

validacao, WABA-VAL, mesmo chat, 9 digito, falso sucesso, findReplyInChat, sendText
