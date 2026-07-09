# LOG — Hex créditos Outros v2 (hexa_Corrigido_V2.png)

## Pedido
Substituir imagem do menu Créditos (hex cluster) para assinantes **Outros**. Segmento **Bets** sem alteração.

## Solução
- Asset fonte: `media/hexa_Corrigido_V2.png`
- Substituído `media/disparos-hex-cluster.png` (usado por `DISPAROS_HEX_CLUSTER_ART_DEFAULT` / `syncDisparosHexClusterArt()` quando **não** é Bets)
- Bets continua: `DISPAROS_HEX_CLUSTER_ART_BETS` → `/media/creditBet_02.png`
- Espelho em `dist/media/disparos-hex-cluster.png`
- Marker: `DEPLOY-2026-07-09-creditos-hex-outros-v2-imagem`

## Arquivos
- `media/disparos-hex-cluster.png` (binário atualizado)
- `dist/media/disparos-hex-cluster.png`
- `src/deploy-marker.ts`

## Validar
- Login assinante **Outros** → Créditos → Contratar → hex nova arte
- Login assinante **Bets** → mesma tela → `creditBet_02.png` inalterado

## Palavras-chave
disparos-hex-cluster, hexa_Corrigido_V2, syncDisparosHexClusterArt, segmento outros, creditBet_02 bets
