# OG compartilhamento — compBoasvindasV3

## Contexto

Atualizar imagem de preview ao compartilhar link WABA.

## Ações

1. `compBoasvindasV3.png` copiada de `D:\Waba\media\` para `media/compBoasvindasV3.png`.
2. Meta `og:image` e `twitter:image` → `https://waba.draxsistemas.com.br/media/compBoasvindasV3.png`
3. Arquivos: `index.html`, `public-pages/vendas.html`, `public-pages/cadastro.html`.
4. `npm run build` — `dist/media/compBoasvindasV3.png` + `dist/index.html`.

## Validar

- `GET /media/compBoasvindasV3.png` após deploy.
- Facebook/WhatsApp: re-scrape se cache antigo.

## Palavras-chave

`compBoasvindasV3`, `og:image`
