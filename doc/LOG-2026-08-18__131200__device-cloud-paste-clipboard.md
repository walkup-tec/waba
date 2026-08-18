# Device Cloud: colar com Ctrl+V no WhatsApp

## Contexto

O teclado local já escrevia no campo focado, mas Ctrl+V era ignorado (`ctrlKey` abortava o handler). Não havia evento `paste`.

## Solução

Com a tela do celular em foco (borda verde): copiar no computador (Ctrl+C) e colar no WhatsApp (Ctrl+V). O texto vai em pedaços de até 80 caracteres (`input/text`); quebras de linha viram Enter.

## Arquivos

- `index.html`, `dist/index.html` — `deviceCloudLocalClipboard`
- Marker `DEPLOY-2026-08-18-131200-device-cloud-paste`

## Validação

Copiar um texto no PC, clicar no campo Descrição, Ctrl+V. O texto deve aparecer no Android.

## Palavras-chave

device-cloud, paste, clipboard, Ctrl+V, descrição
