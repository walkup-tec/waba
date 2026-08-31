# Device Cloud: teclado do computador no WhatsApp

## Contexto

Campos do WhatsApp (ex.: Descrição) abrem o teclado virtual do Android. Digitar só pelo teclado na tela ou pelo campo DDD é ruim. O teclado local só enviava dígitos; Backspace mandava KEYCODE_BACK e saía da tela.

## Solução

- Clique na tela do celular (borda verde = foco) e digite no teclado do computador.
- Letras, números, espaço, acentos e pontuação comum vão em `input/text`.
- Backspace = KEYCODE_DEL (não mais BACK). Enter = ENTER.
- Device Cloud API: allowlist `KEYCODE_DEL` + pontuação extra no `TEXT_RE`.

## Arquivos

- `index.html`, `dist/index.html` — `deviceCloudLocalKeyboard`
- `src/device-cloud/waba-device-cloud.routes.ts` + dist — key `del`
- AWS `/opt/device-cloud` — `KEYCODE_DEL`
- Marker `DEPLOY-2026-08-18-130200-device-cloud-local-kbd`

## Validação

Clicar no campo Descrição, ver borda verde, escrever com o teclado do PC. Backspace apaga o texto sem sair da tela.

## Palavras-chave

device-cloud, teclado, input/text, KEYCODE_DEL, descrição WhatsApp
