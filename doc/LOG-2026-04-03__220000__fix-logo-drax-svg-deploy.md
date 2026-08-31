# LOG — Logo DRAX (SVG) + build + deploy

## Contexto

Logo DRAX “corrompida”: referências a `/media/Drax-logo-footer.png` sem ficheiro válido no repo. Deploy Docker não copiava `media/`.

## Solução

1. Criado **`media/drax-logo.svg`** (wordmark DRAX, gradiente alinhado ao theme-color).
2. **`index.html`**: favicon e `<img>` passam a usar `/media/drax-logo.svg`.
3. **`Dockerfile`**: `COPY media ./media` antes do build.
4. `npm run build` — `dist/` atualizado com `media/drax-logo.svg`.

## Atualize tudo

- `npm run build` executado.
- Script `C:\Scripts\backup-d-para-e.ps1` falhou neste ambiente (unidade `D:` inexistente).

## Deploy

- `git push origin master` dispara **GitHub Actions FTP**; **EasyPanel** deve refazer build a partir do Git para imagem Docker.

## Ficheiros alterados

- `media/drax-logo.svg` (novo)
- `index.html`, `dist/index.html`, `dist/media/drax-logo.svg`
- `Dockerfile`
- `dist/index.js` (se incluído no commit após `tsc`)

## Palavras-chave

`drax-logo`, `media`, `svg`, `Dockerfile COPY media`
