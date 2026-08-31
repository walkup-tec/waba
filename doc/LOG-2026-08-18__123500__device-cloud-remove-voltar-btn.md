# Device Cloud: remover botão Voltar da barra

## Contexto

O toque na tela do Android já volta no WhatsApp. O botão chrome **Voltar** (ao lado de Abrir / Início) ficou redundante e apertava a barra de ações.

## Ações

Removido o botão, o CSS `.device-cloud-key-back` e o handler `key: back`. Mantidos **Abrir**, **Início**, **Foto perfil** e **Capa**.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`, `dist/deploy-marker.js` — `DEPLOY-2026-08-18-124100-device-cloud-no-voltar`
- HTML: comentário `deviceCloudNoChromeVoltar`

## Validação

Após o Deploy FTP: Ctrl+F5 em Dispositivos. A barra deve mostrar WhatsApp: Abrir, Início, Foto perfil, Capa — sem Voltar. Voltar no app continua pelo toque na tela.

## Palavras-chave

device-cloud, voltar, media-bar, layout, keyevent back
