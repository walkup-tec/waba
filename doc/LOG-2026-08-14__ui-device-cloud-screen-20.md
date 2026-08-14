# LOG — Tela do dispositivo +20%

## Contexto
Aumentar a tela do Android virtual na aba Dispositivos em 20% em relação ao tamanho anterior.

## Ações
- `index.html`: `#device-cloud-phone-wrap` `max-width` 420px → 504px
- `index.html`: `#device-cloud-screen` `max-height` 72vh → 86vh
- `src/deploy-marker.ts`: `DEPLOY-2026-08-14-device-cloud-screen-20`
- `node scripts/copy-index-html.mjs` → `dist/index.html`

## Como validar
Abrir Dispositivos, criar/abrir o celular e conferir a screenshot maior. Toque continua mapeado pelo bounding box da imagem.

## Palavras-chave
device-cloud, tela, screenshot, max-width, max-height, 504px, 86vh
