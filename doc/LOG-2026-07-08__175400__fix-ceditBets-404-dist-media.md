# Fix — `ceditBets.png` corrompido (404 em dist/media)

## Causa raiz (confirmada)

1. Ficheiro ausente em `dist/media/` (corrigido com build).
2. **V02 `WABA_BASE_PATH=/version-02`:** `syncDisparosHexClusterArt()` gravava `src="/media/ceditBets.png"` sem prefixo → browser pedia `localhost:3012/media/...` (404). URL correta: `/version-02/media/ceditBets.png` (200).

## Correção

`syncDisparosHexClusterArt()` passa a usar `resolveWabaPublicPath(art.src)` antes de setar o `src` da `<img>`.

## Validar

Hard refresh como assinante Bets; DevTools → Network → `ceditBets.png` deve ser 200 em `/version-02/media/ceditBets.png`.
