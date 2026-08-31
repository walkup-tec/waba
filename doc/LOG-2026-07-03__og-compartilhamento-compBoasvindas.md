# LOG — OG image compartilhamento redes sociais

**Data:** 2026-07-03

## Pedido

Configurar imagem `compBoasvindas.png` para preview ao compartilhar link do sistema (Open Graph / Twitter).

## Solução

1. Imagem em `media/compBoasvindas.png` (1254×1254, copiada de `D:\Waba\media\`).
2. Build copia `media/` → `dist/media/` (`scripts/copy-index-html.mjs`).
3. Meta tags `og:*` e `twitter:*` em:
   - `index.html` (app principal)
   - `public-pages/vendas.html`
   - `public-pages/cadastro.html`
4. URL da imagem: `https://waba.draxsistemas.com.br/media/compBoasvindas.png`

## Validar

- Deploy marker `DEPLOY-2026-07-03-og-compartilhamento-compBoasvindas`
- Abrir `https://waba.draxsistemas.com.br/media/compBoasvindas.png`
- Facebook Sharing Debugger / WhatsApp link preview

## Palavras-chave

`og:image`, `compBoasvindas`, compartilhamento, meta tags
