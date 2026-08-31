# Bets — ocultar saldo API Alternativa no Resumo

## Contexto
Assinantes segmento **Bets** só usam API Oficial. O card **Saldos** no Resumo ainda exibia bloco API Alternativa (Disponíveis/Bonificados).

## Correção
- `#disparos-resumo-api-alternativa` oculto com `body.waba-subscriber-bets-segment`
- `syncDisparosResumoSide`: total disponível só soma Oficial para Bets
- `renderDisparosCreditsApiSplit`: card alternativa `hidden` para Bets
- `syncDisparosPricingBoardForSegment`: toggle do bloco resumo

## Validar (V02, assinante Bets)
1. API Oficial → Resumo → Saldos: só **API Oficial**
2. Créditos/hub: sem card API Alternativa

## Palavras-chave
`bets saldo`, `API Alternativa ocultar`, `disparos-resumo`, `waba-subscriber-bets-segment`
