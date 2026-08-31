# Fix — OG image não indexada (boas-vindas Corban)

## Contexto

Novo assinante `digitalcorban@gmail.com` cadastrado — tudo funcionou (e-mail, WhatsApp, senha), **exceto o preview de compartilhamento** do link enviado. WhatsApp/Meta não estavam indexando a imagem OG.

## Diagnóstico

- `GET https://waba.draxsistemas.com.br/` → 200, meta OG presentes.
- `GET https://waba.draxsistemas.com.br/media/compBoasvindasV3.png` → 200, `Content-Type: image/png`, 988 ms.
- **Problema:** imagem tinha **1.497.516 bytes (1.5 MB)** e 1254×1254 (dimensão fora do padrão OG).

## Causa raiz

Scrapers do WhatsApp/Facebook aplicam limite prático de ~300 KB para imagens de preview. PNG de 1.5 MB é frequentemente descartado sem gerar preview.

## Solução

1. Redimensionado para **1200×1200** (limite quadrado do OG).
2. Convertido para **JPEG q82** → **140 KB** (91% menor).
3. Meta tags atualizadas em `index.html`, `public-pages/vendas.html`, `public-pages/cadastro.html`:
   - `og:image` → `.jpg`
   - `og:image:type` → `image/jpeg`
   - `og:image:width/height` → `1200`
   - `og:image:alt` adicionado (boa prática Meta).
   - `twitter:image` → `.jpg`
4. `dist/media/compBoasvindasV3.jpg` incluído no build.

## Arquivos criados/alterados

- `media/compBoasvindasV3.jpg` (novo, 140 KB)
- `dist/media/compBoasvindasV3.jpg` (novo)
- `index.html`, `dist/index.html`
- `public-pages/vendas.html`, `public-pages/cadastro.html`

## Validação

1. Após deploy, testar no Facebook Sharing Debugger: <https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fwaba.draxsistemas.com.br%2F> → clicar **Scrape Again**.
2. Testar preview do link em conversa nova do WhatsApp (rascunho com URL cola preview em 1–2 s se OG for válido).
3. `.png` antigo permanece em disco (pode ser removido depois).

## Segurança

Sem alteração de auth ou dados sensíveis.

## Palavras-chave

`og:image`, `compBoasvindasV3`, preview WhatsApp, Facebook scraper, tamanho OG, 300KB
