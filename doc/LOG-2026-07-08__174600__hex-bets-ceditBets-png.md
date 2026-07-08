# Hex Contratar Bets — `ceditBets.png`

## Contexto

Assinantes **Bets** passam a usar arte dedicada `media/ceditBets.png` (1024×1536) no bloco Contratar/créditos, no lugar do hexágono de produção. **Outros segmentos** mantêm `hexa-corrigi-2.png` + linhas SVG animadas (sem alteração no commit para Outros).

## Solução

1. CSS `body.waba-subscriber-bets-segment`:
   - oculta `.disparos-hex-light-lines`
   - `mix-blend-mode: normal` na imagem (fundo preto da arte Bets)
   - `aspect-ratio: 1024 / 1536`
2. `syncDisparosHexClusterArt()` troca `src`/dimensões/alt entre default e Bets.
3. Chamada em `syncDisparosPricingBoardForSegment()` após toggle da classe no `body`.

## Arquivos

- `media/ceditBets.png` — asset Bets (usuário)
- `index.html` — CSS + JS

## Validar

1. Login assinante Bets → aba Créditos/Contratar → imagem `ceditBets.png`, sem linhas animadas.
2. Assinante Outros → `hexa-corrigi-2.png` + SVG como produção.
3. `npm run build` copia `media/` para `dist/media/` (inclui `ceditBets.png`).

## Palavras-chave

`ceditBets`, `syncDisparosHexClusterArt`, `waba-subscriber-bets-segment`, hex-cluster
