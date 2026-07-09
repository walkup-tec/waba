# LOG — Hex Créditos Outros: restaurar imagem inteira e remover SVG

**Data:** 2026-07-09  
**Contexto:** Tela Contratar créditos (segmento Outros) exibia `hexa-corrigi-2.png` cortada no topo com overlay SVG de linhas animadas. Usuário pediu restaurar arte inteira da semana passada e remover efeito SVG.

## Causa

- Arte `hexa-corrigi-2.png` (3000×4000) com grande área escura inferior + `mix-blend-mode: lighten` + `aspect-ratio: 3000/4000` gerava corte visual no topo.
- Bloco SVG `.disparos-hex-light-lines` desenhava traços correndo sobre a área escura.

## Solução

1. **Imagem Outros** restaurada para `media/disparos-hex-cluster.png` (1024×1024) — asset original com os 3 hexágonos inteiros (commit `207841e`).
2. **Removido** SVG `.disparos-hex-light-lines` e todo CSS/keyframes associado.
3. **CSS** — `height: auto`, `mix-blend-mode: normal`, stage sem `aspect-ratio` fixo.
4. **`DISPAROS_HEX_CLUSTER_ART_DEFAULT`** atualizado para `disparos-hex-cluster.png`.
5. **Bets** inalterado: `creditBet_02.png` via `syncDisparosHexClusterArt()`.

## Arquivos alterados

- `index.html`
- `dist/index.html` (via `node scripts/copy-index-html.mjs`)

## Validar

V02 → Disparos → Contratar (conta Outros): três hexágonos visíveis por completo, sem linhas animadas. Bets continua com arte dedicada.

## Palavras-chave

`disparos-hex-cluster.png`, `disparos-hex-cluster-art`, `hex-orbit`, `hexa-corrigi-2`, `syncDisparosHexClusterArt`, Contratar créditos Outros
