# Campanha Alternativa: só imagem, sem texto/botão

## Contexto

Após o marker `alternativa-no-proxy-mid-send`, o destino recebia só a imagem 1080.

## Causa

1. Imagem é enviada primeiro. Se `sendButtons` falhava ou o ACK da imagem não era `DELIVERY_ACK`, o lead voltava a `pending` **sem texto** — a imagem já tinha ido.
2. Evolution 2.3.x devolve CTA em `viewOnceMessage`. O WABA tratava isso como sucesso e não enviava o texto visível; o viewOnce não aparece no chat.

## Solução

- ACK da imagem: só aborta em ERROR; SERVER_ACK segue para texto/botão.
- `viewOnce` = botão não visível → envia **texto sem URL** (sem card).
- Não reagenda o lead após a imagem ter sido enviada.

## Marker

`DEPLOY-2026-08-20-alternativa-image-then-text`

## Palavras-chave

sendButtons, viewOnceMessage, só imagem, DELIVERY_ACK, API Alternativa
