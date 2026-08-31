# LOG — Device Cloud: scroll do mouse na tela do Android

## Contexto

O usuário precisa que a roda do mouse role a tela do device, não a página do WABA.

## Solução

- Listener `wheel` na imagem (passive: false) impede o scroll da página.
- Deltas acumulados ~40 ms viram um `swipe` invertido (roda para baixo = conteúdo desce).
- Marker `DEPLOY-2026-08-18-device-cloud-wheel-scroll`

## Arquivos

- `.tmp-master-financeiro/index.html`
- `.tmp-master-financeiro/src/deploy-marker.ts`
- `.tmp-master-financeiro/dist/deploy-marker.js`

## Como validar

Após deploy: passar o mouse sobre a tela do 6034 e girar a roda; a lista de horários deve subir/descer.

## Palavras-chave

device-cloud, wheel, scroll, swipe, mouse
