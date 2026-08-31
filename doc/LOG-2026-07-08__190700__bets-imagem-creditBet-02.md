# Bets — trocar arte para `creditBet_02.png`

**Data:** 2026-07-08  
**Contexto:** Usuário editou nova imagem `media/creditBet_02.png` (1024×1024) para substituir `ceditBets.png` no bloco Contratar Bets.

## Alterações

1. `DISPAROS_HEX_CLUSTER_ART_BETS.src` → `/media/creditBet_02.png`
2. Dimensões JS/CSS → `1024×1024`, `aspect-ratio: 1 / 1`
3. Removido crop CSS anterior (`1506`, `overflow: hidden`, `object-fit: cover`) — arquivo já vem recortado

## Arquivos

- `index.html`
- `dist/index.html`, `dist/media/creditBet_02.png` (via build)

## Validar

Assinante Bets → Créditos/Comprar → Ctrl+F5 → Network `creditBet_02.png` 200 em `/version-02/media/creditBet_02.png`.

## Palavras-chave

`creditBet_02`, `ceditBets`, `syncDisparosHexClusterArt`, `bets`
