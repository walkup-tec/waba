# OG compartilhamento — compBoasvindasV2

## Contexto

Atualizar a imagem de preview ao compartilhar o link WABA nas redes (Open Graph / Twitter).

## Ações

1. Copiada `compBoasvindasV2.png` (1254×1254) de `D:\Waba\media\` para `media/compBoasvindasV2.png`.
2. Meta tags `og:image` e `twitter:image` apontam para:
   `https://waba.draxsistemas.com.br/media/compBoasvindasV2.png`
3. Arquivos: `index.html`, `public-pages/vendas.html`, `public-pages/cadastro.html`.
4. `npm run build` — `dist/media/` e `dist/index.html` sincronizados.

## Validar

- `GET https://waba.draxsistemas.com.br/media/compBoasvindasV2.png` após deploy.
- Facebook Sharing Debugger / WhatsApp link preview (cache pode exigir re-scrape).

## Palavras-chave

`compBoasvindasV2`, `og:image`, compartilhamento
