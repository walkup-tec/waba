# Logo Meta PNG sem fundo

## Contexto

O modal de envio precisava da marca Meta em PNG, sem fundo preto.

## Fonte

- Wikimedia Commons: [File:Meta Platforms logo.svg](https://commons.wikimedia.org/wiki/File:Meta_Platforms_logo.svg)
- Origem declarada: about.meta.com/brand/resources/meta/company-brand
- Licença Commons: PD-textlogo (formas geométricas simples)
- Raster: `rsvg-convert` 512×337, fundo `none` → RGBA

## Solução

Arquivo em `media/meta-logo.png`. O modal usa `<img>` com fundo transparente.

## Como validar

`GET /media/meta-logo.png` e o modal **Enviar para META**.

## Palavras-chave

meta-logo, png, transparente, wikimedia, modal
