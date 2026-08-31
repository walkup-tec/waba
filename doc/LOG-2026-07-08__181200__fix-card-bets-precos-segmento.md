# Fix — card API Oficial Bets voltou texto padrão (0,25–0,32)

## Problema

Card Contratar mostrava `De R$ 0,25 a R$ 0,32` + mínimo R$ 320 para assinante Bets. O `sync` existia mas não era reaplicado em todos os fluxos (aba Comprar, modal repurchase, init UI).

## Solução

1. Faixa **calculada da tabela** `betsOficial` / `oficial` (`formatDisparosPriceRangeFromTiers`) → hoje Bets: **De R$ 0,33 a R$ 0,42**.
2. HTML com spans `disparos-api-price-bets` / `disparos-api-min-bets` + CSS `body.waba-subscriber-bets-segment` (fallback visual).
3. Subtexto Bets: **Escolha o melhor pacote para você**.
4. `syncDisparosPricingBoardForSegment()` também em: `initUiProfile`, `setDisparosCreditsHubTab(purchase)`, `mountDisparosPurchaseContent`, `initDisparosApiChoice`.

## Validar

Login assinante **segmento Bets** → Créditos → Comprar → card API Oficial com faixa 0,33–0,42 e frase de pacotes.

## Palavras-chave

`syncDisparosPricingBoardForSegment`, `applyDisparosOficialCardPricingCopy`, `disparos-api-price-bets`
