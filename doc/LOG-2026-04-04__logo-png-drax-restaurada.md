# LOG — Logo DRAX PNG restaurada

## Contexto

Lembra do fluxo antigo: logo oficial em `media/Drax-logo-footer.png`. SVG/texto no header falhava em produção.

## Ações

1. Download do PNG via Google Drive (`id=1f431Xz55iji0h-kuS0GZOa1tFbYYFQ_e`), documentado em `doc/LOG-2026-03-27__114526__update-logo-drax-asset-ajustada-drive.md`.
2. `index.html`: favicon + `<img src="/media/Drax-logo-footer.png">`.
3. Removido `media/drax-logo.svg`.
4. `scripts/copy-index-html.mjs`: `rm` recursivo em `dist/media` antes de `cp` para não deixar ficheiros obsoletos.

## Commit

`dcf696e` — push `master`.

## Validar

`npm run build`; abrir `/media/Drax-logo-footer.png` no servidor; **Implantar** EasyPanel.

## Palavras-chave

`Drax-logo-footer.png`, `copy-index-html`, `dist/media`
