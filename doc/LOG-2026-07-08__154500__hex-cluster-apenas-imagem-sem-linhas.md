# LOG — Hex cluster Contratar: só imagem, sem linhas animadas

**Data:** 2026-07-08  
**Contexto:** Tela Contratar créditos — remover efeito SVG de linhas correndo; exibir hexágonos completos (Bets e Outros).

## Alterações (`index.html`)

1. **Removido** SVG `.disparos-hex-light-lines` e CSS de animação `hex-orbit-comet`.
2. **CSS** — imagem com `height: auto`, `mix-blend-mode: normal`, grid `align-items: start` (evita corte parcial).
3. **`syncDisparosHexClusterArt()`** — troca PNG por segmento:
   - **Bets:** `/media/disparos-hex-api-oficial.png`
   - **Outros:** `/media/disparos-hex-cluster.png`

## Validar

V02 → Disparos → Contratar: hexágono(s) inteiro(s), sem linhas animadas.

## Palavras-chave

`disparos-hex-cluster-art`, `syncDisparosHexClusterArt`, `hex-orbit`, `disparos-pricing-board`
