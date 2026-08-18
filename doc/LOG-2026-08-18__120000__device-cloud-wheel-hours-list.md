# Device Cloud: roda do mouse não rolava horários

## Contexto

Na tela Selecionar horários o toque já funcionava; a roda do mouse sobre o celular não movia a lista (sábado fora da tela).

## Causa

O giro virava um swipe curto (filtro 14 px, duração 160 ms, y preso no botão Avançar). O palco `#device-cloud-stage` tem `overflow: auto` e podia absorver a roda. O `adb input swipe` longo na lista funciona.

## Solução

Cada burst da roda envia um swipe de página (~980→380, 320 ms) no meio da lista. Listener na janela do celular (capture). Refresh do screenshot após swipe em 480 ms.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`, `dist/deploy-marker.js` — `DEPLOY-2026-08-18-device-cloud-wheel-list`

## Validação

Swipe WABA `360,980 → 360,380` / 320 ms moveu a lista (Qua/Qui/Sex). Publicar `dist/index.html` para o browser do usuário receber o handler.

## Palavras-chave

device-cloud, wheel, swipe, selecionar horários, overflow stage
