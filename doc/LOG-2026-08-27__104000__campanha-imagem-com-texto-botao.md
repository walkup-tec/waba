# Campanha: imagem sem texto e sem botão (5401)

## Contexto do pedido

Mensagens chegando só com a imagem, sem texto e sem botão. Principalmente no WB-5401 (`walkup-5401`).

## Causa

1. Depois do `sendMedia`, o motor só seguia para texto/botão se o ACK fosse `DELIVERY_ACK`. `SERVER_ACK`/`UNKNOWN` (comum no 5401) abortava o ciclo: imagem já tinha ido.
2. O próximo lead escolhido era o **sem** `mediaMessageId`. Com milhares de pendentes, o 5401 só disparava imagem nova e nunca fechava a sequência.
3. Se `sendButtons` falhasse, o lead voltava a pending **sem** texto — outra via de “só imagem”.

## Solução

- `SERVER_ACK` (e demais não-ERROR) segue para texto/botão no mesmo ciclo.
- Completa primeiro o lead que já tem imagem (`mediaMessageId`) quando o chip não está em cooldown.
- `sendButtons` indisponível: envia texto sem URL (imagem já foi).

## Arquivos

- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-27-campanha-imagem-com-texto-botao`
- `dist/index.js`, `dist/deploy-marker.js`

## Como validar

- Após Redeploy EasyPanel `waba_disparador`: `/health` com o marker acima
- Próximos envios do 5401: imagem + texto + botão (ou texto sem URL se o botão nativo falhar)
- Sem `sendText` de diagnóstico

## Segurança

Sem probe WhatsApp extra. Sem log de tokens.

## Palavras-chave

campanha, só imagem, 5401, walkup-5401, DELIVERY_ACK, mediaMessageId, sendButtons
