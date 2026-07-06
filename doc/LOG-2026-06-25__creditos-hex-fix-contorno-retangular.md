# LOG — Fix contorno retangular nos glows do hex

## Problema

Camadas CSS (`disparos-hex-cluster-glow` verde/azul/centro + `::before`) criavam faixas retangulares visíveis sobre o PNG.

## Solução

- Removidos stage, spans de glow, pseudo-elemento e `drop-shadow` coloridos.
- PNG com `mix-blend-mode: lighten` para fundir preto/canvas da arte com `#0b111b`.
- Tamanho (+20%) mantido.

## Arquivos

- `index.html`, `dist/index.html`

## Palavras-chave

`mix-blend-mode lighten`, remover disparos-hex-cluster-glow
