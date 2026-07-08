# LOG — Bets: reduzir altura da imagem (crop 30px inferior)

**Data:** 2026-07-08  
**Contexto:** Pedido para reduzir o tamanho visual da arte Bets (`ceditBets.png`), preservando o topo e cortando 30px da borda inferior, sem editar o PNG.

## Solução

Crop visual via CSS no segmento Bets:

- `aspect-ratio` do stage: `1024 / 1506` (1536 − 30)
- `overflow: hidden` no stage
- `object-fit: cover` + `object-position: top center` na imagem
- Constante `DISPAROS_HEX_CLUSTER_ART_BETS.height` atualizada para `1506`

## Arquivos alterados

- `index.html` — CSS `body.waba-subscriber-bets-segment` + `DISPAROS_HEX_CLUSTER_ART_BETS`
- `dist/index.html` — via `npm run build`

## Como validar

1. `npm run build` (já executado)
2. Abrir V02 como assinante Bets: `http://localhost:3012/version-02/`
3. Ctrl+F5 na aba Créditos/Comprar
4. Confirmar: topo da imagem intacto, ~30px a menos na parte inferior, diferenciais ainda colados abaixo

## Observação

Se o crop não ficar perfeito (artefato de `object-fit: cover` nas laterais), editar `media/ceditBets.png` no editor de imagem para 1024×1506.

## Palavras-chave

`ceditBets`, `bets`, `hex-cluster`, `crop`, `aspect-ratio`, `object-position`
